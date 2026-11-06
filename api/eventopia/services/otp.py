from collections.abc import Callable
from datetime import datetime, timedelta
from hashlib import sha256
from hmac import compare_digest
from hmac import new as hmac_new
from math import ceil
from secrets import randbelow
from uuid import uuid4

from eventopia.config import AuthSection
from eventopia.context.sqlite import SqliteConnector
from eventopia.exceptions import InvalidCodeError, RateLimitedError, ValidationError
from eventopia.models.auth import OtpChallengeRecord
from eventopia.phone import normalize_phone
from eventopia.services.account import AccountService
from eventopia.services.session import utcnow
from eventopia.sqls import accounts, otp, telegram
from eventopia.telegram.gateway import (
    TelegramApiError,
    TelegramForbiddenError,
    TelegramGateway,
)
from eventopia.telegram.texts import otp_message, pick_language


def _random_6_digits() -> str:
    return f"{randbelow(10**6):06d}"


class OtpService:
    def __init__(
        self,
        sqlite: SqliteConnector,
        telegram: TelegramGateway,
        account_service: AccountService,
        auth_config: AuthSection,
        clock: Callable[[], datetime] = utcnow,
        code_factory: Callable[[], str] = _random_6_digits,
    ) -> None:
        self._sqlite = sqlite
        self._telegram = telegram
        self._account_service = account_service
        self._config = auth_config
        self._clock = clock
        self._code_factory = code_factory

    async def request_code(self, phone_raw: str, ip: str | None) -> int:
        phone = normalize_phone(phone_raw, self._config["default_phone_region"])
        async with self._sqlite.session(write=True) as s:
            now = self._clock()
            deadlines = []
            latest = await otp.latest_created_for_phone(s, phone)
            if latest is not None:
                deadlines.append(
                    latest + timedelta(seconds=self._config["otp_resend_seconds"])
                )
            phone_limit = await otp.nth_latest_created_for_phone(
                s, phone, self._config["otp_max_per_phone_per_hour"]
            )
            if phone_limit is not None:
                deadlines.append(phone_limit + timedelta(hours=1))
            if ip is not None:
                ip_limit = await otp.nth_latest_created_for_ip(
                    s, ip, self._config["otp_max_per_ip_per_hour"]
                )
                if ip_limit is not None:
                    deadlines.append(ip_limit + timedelta(hours=1))
            retry_after = max(
                (ceil((deadline - now).total_seconds()) for deadline in deadlines),
                default=0,
            )
            if retry_after > 0:
                raise RateLimitedError(retry_after=retry_after)

            # Quotas and reservation share the write lock, including unknown phones.
            identity = await self._account_service.get_active_identity_by_phone(
                phone, session=s
            )
            code = self._code_factory()
            challenge_id = str(uuid4())
            await otp.supersede_open_challenges(s, phone, now)
            await otp.insert_challenge(
                s,
                OtpChallengeRecord(
                    id=challenge_id,
                    phone_e164=phone,
                    account_uid=identity.account_uid if identity else None,
                    code_hash=self._digest(challenge_id, code),
                    created_at=now,
                    expires_at=now + timedelta(seconds=self._config["otp_ttl_seconds"]),
                    attempts=0,
                    consumed_at=None,
                    superseded_at=None,
                    requester_ip=ip or "",
                    delivered=False,
                ),
            )

        # Never hold SQLite's cross-process write reservation across Telegram I/O.
        if identity is not None:
            try:
                await self._telegram.send_message(
                    identity.chat_id,
                    otp_message(
                        pick_language(identity.language_code),
                        code,
                        ceil(self._config["otp_ttl_seconds"] / 60),
                    ),
                    protect_content=True,
                )
            except TelegramForbiddenError:
                await self._account_service.set_chat_active(
                    identity.telegram_user_id, False
                )
            except TelegramApiError:
                # Delivery failures must have the same public response as unknowns.
                pass
            else:
                async with self._sqlite.session(write=True) as s:
                    await otp.mark_delivered(s, challenge_id, self._clock())
        return self._config["otp_resend_seconds"]

    async def verify_code(self, phone_raw: str, code: str) -> str:
        try:
            phone = normalize_phone(phone_raw, self._config["default_phone_region"])
        except ValidationError:
            raise InvalidCodeError() from None
        uid = None
        async with self._sqlite.session(write=True) as s:
            now = self._clock()
            challenge = await otp.select_open_challenge(s, phone, now)
            if (
                challenge is not None
                and challenge.attempts < self._config["otp_max_attempts"]
            ):
                await otp.increment_attempts(s, challenge.id)
                # Re-read ownership inside the same transaction as consumption.
                identity = await telegram.select_identity_by_phone(s, phone)
                account = (
                    await accounts.select_account(s, challenge.account_uid)
                    if challenge.account_uid is not None
                    else None
                )
                if (
                    challenge.delivered
                    and identity is not None
                    and identity.account_uid == challenge.account_uid
                    and identity.phone_verified_at is not None
                    and account is not None
                    and account.status == "active"
                    and isinstance(code, str)
                    and len(code) == 6
                    and code.isascii()
                    and code.isdigit()
                    and compare_digest(
                        self._digest(challenge.id, code), challenge.code_hash
                    )
                ):
                    await otp.mark_consumed(s, challenge.id, now)
                    uid = challenge.account_uid
        # Failed attempts must commit before the generic domain error is raised.
        if uid is None:
            raise InvalidCodeError()
        return uid

    def _digest(self, challenge_id: str, code: str) -> str:
        return hmac_new(
            self._config["otp_pepper"].encode(),
            f"{challenge_id}:{code}".encode(),
            sha256,
        ).hexdigest()
