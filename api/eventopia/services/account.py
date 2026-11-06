import logging
import re
import unicodedata
from collections.abc import Iterator
from datetime import UTC, datetime
from random import Random, SystemRandom
from time import monotonic
from uuid import uuid4

from neo4j.exceptions import ConstraintError

from eventopia.config import AuthSection
from eventopia.context.neo4j import Neo4jConnector
from eventopia.context.sqlite import SqliteConnector
from eventopia.cyphers import users
from eventopia.exceptions import ForeignContactError, NotFoundError
from eventopia.models.auth import (
    RegistrationResult,
    SharedContact,
    TelegramIdentityRecord,
    TelegramUser,
    UserProfile,
)
from eventopia.phone import mask_phone, normalize_phone
from eventopia.sqls import accounts, otp, sessions, telegram

_logger = logging.getLogger(__name__)
_USERNAME = re.compile(r"[a-z0-9_]{3,32}", re.ASCII)


class AccountService:
    def __init__(
        self, neo4j: Neo4jConnector, sqlite: SqliteConnector, auth_config: AuthSection
    ) -> None:
        self._neo4j = neo4j
        self._sqlite = sqlite
        self._auth_config = auth_config
        self._rng = SystemRandom()
        self._active_cache: dict[str, tuple[float, bool]] = {}

    async def register_from_contact(
        self, sender: TelegramUser, contact: SharedContact, chat_id: int
    ) -> RegistrationResult:
        if contact.user_id != sender.id:
            raise ForeignContactError()
        phone = normalize_phone(
            contact.phone_number, self._auth_config["default_phone_region"]
        )
        now = datetime.now(UTC)
        takeover = False
        async with self._sqlite.session(write=True) as s:
            identity = await telegram.select_identity_by_telegram_id(s, sender.id)
            owner = await telegram.select_identity_by_phone(s, phone)
            if (
                identity is not None
                and identity.phone_e164 is not None
                and identity.phone_e164 != phone
            ):
                await otp.supersede_open_challenges(s, identity.phone_e164, now)
            if (
                owner is None
                or owner.telegram_user_id != sender.id
                or owner.phone_verified_at is None
            ):
                await otp.supersede_open_challenges(s, phone, now)
            if owner is not None and owner.telegram_user_id != sender.id:
                await telegram.set_identity_phone(
                    s, owner.telegram_user_id, None, None, now
                )
                await sessions.revoke_all_for_account(s, owner.account_uid, now)
                takeover = True
            is_new = identity is None
            if identity is None:
                uid = str(uuid4())
                await accounts.insert_account(s, uid, now)
                await telegram.insert_identity(
                    s,
                    TelegramIdentityRecord(
                        account_uid=uid,
                        telegram_user_id=sender.id,
                        chat_id=chat_id,
                        phone_e164=phone,
                        phone_verified_at=now,
                        username=sender.username,
                        first_name=sender.first_name,
                        last_name=sender.last_name,
                        language_code=sender.language_code,
                        chat_active=True,
                        chat_status_changed_at=now,
                        updated_at=now,
                    ),
                )
            else:
                uid = identity.account_uid
                await telegram.update_identity_profile(
                    s,
                    sender.id,
                    chat_id=chat_id,
                    username=sender.username,
                    first_name=sender.first_name,
                    last_name=sender.last_name,
                    language_code=sender.language_code,
                    now=now,
                )
                await telegram.set_identity_phone(s, sender.id, phone, now, now)
                await telegram.set_chat_active(s, sender.id, True, now)
        if takeover:
            _logger.warning(
                "Verified phone transferred to another identity: %s", mask_phone(phone)
            )
        profile = await self.ensure_profile(uid)
        return RegistrationResult(uid, profile.username, phone, is_new)

    async def touch_identity(
        self, sender: TelegramUser, chat_id: int
    ) -> TelegramIdentityRecord | None:
        now = datetime.now(UTC)
        async with self._sqlite.session(write=True) as s:
            if await telegram.select_identity_by_telegram_id(s, sender.id) is None:
                return None
            await telegram.update_identity_profile(
                s,
                sender.id,
                chat_id=chat_id,
                username=sender.username,
                first_name=sender.first_name,
                last_name=sender.last_name,
                language_code=sender.language_code,
                now=now,
            )
            await telegram.set_chat_active(s, sender.id, True, now)
            return await telegram.select_identity_by_telegram_id(s, sender.id)

    async def set_chat_active(self, telegram_user_id: int, active: bool) -> None:
        async with self._sqlite.session(write=True) as s:
            await telegram.set_chat_active(
                s, telegram_user_id, active, datetime.now(UTC)
            )

    async def get_identity_by_telegram_id(
        self, tg_id: int
    ) -> TelegramIdentityRecord | None:
        async with self._sqlite.session() as s:
            return await telegram.select_identity_by_telegram_id(s, tg_id)

    async def get_active_identity_by_phone(
        self, phone_e164: str
    ) -> TelegramIdentityRecord | None:
        async with self._sqlite.session() as s:
            identity = await telegram.select_identity_by_phone(s, phone_e164)
        if (
            identity is not None
            and identity.chat_active
            and identity.phone_verified_at is not None
        ):
            return identity
        return None

    async def ensure_profile(self, uid: str) -> UserProfile:
        profile = await self._neo4j.read(lambda tx: users.select_user(tx, uid))
        if profile is not None:
            return profile
        async with self._sqlite.session() as s:
            account = await accounts.select_account(s, uid)
            identity = await telegram.select_identity_by_account(s, uid)
        if account is None or identity is None:
            raise NotFoundError("Account not found")
        for username in username_candidates(
            identity.username, identity.first_name or "", self._rng
        ):
            if await self._neo4j.read(lambda tx: users.username_taken(tx, username)):
                continue
            try:
                return await self._neo4j.write(
                    lambda tx: users.merge_user(
                        tx,
                        uid,
                        username,
                        identity.first_name,
                        identity.last_name,
                        account.created_at.isoformat(),
                    )
                )
            except ConstraintError as error:
                # A competing registration may win after our availability read.
                # Only reconcile uniqueness races, never unrelated graph failures.
                if error.code != "Neo.ClientError.Schema.ConstraintValidationFailed":
                    raise
                profile = await self._neo4j.read(lambda tx: users.select_user(tx, uid))
                if profile is not None:
                    return profile
                if not await self._neo4j.read(
                    lambda tx: users.username_taken(tx, username)
                ):
                    raise
        raise RuntimeError("Username candidates exhausted")

    async def is_account_active(self, uid: str) -> bool:
        now = monotonic()
        cached = self._active_cache.get(uid)
        if cached is not None and now < cached[0]:
            return cached[1]
        async with self._sqlite.session() as s:
            account = await accounts.select_account(s, uid)
        active = account is not None and account.status == "active"
        self._active_cache = {
            key: value for key, value in self._active_cache.items() if value[0] > now
        }
        self._active_cache[uid] = (now + 60, active)
        return active


def username_candidates(
    telegram_username: str | None, first_name: str, rng: Random
) -> Iterator[str]:
    if telegram_username is not None:
        username = telegram_username.lower()
        if _USERNAME.fullmatch(username):
            yield username
    ascii_name = (
        unicodedata.normalize("NFKD", first_name).encode("ascii", "ignore").decode()
    )
    slug = re.sub(r"[^a-z0-9_]+", "_", ascii_name.lower()).strip("_")[:24] or "user"
    while True:
        yield f"{slug}{rng.randrange(10000):04d}"
