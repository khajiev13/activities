from datetime import UTC, datetime

from eventopia.config import AuthSection, TelegramSection
from eventopia.exceptions import AuthError, InvalidCodeError
from eventopia.models.auth import (
    AccessClaims,
    AccessOut,
    LoginOut,
    MeOut,
    RetryOut,
    UserOut,
    UserProfile,
)
from eventopia.phone import mask_phone, normalize_phone
from eventopia.services.account import AccountService
from eventopia.services.otp import OtpService
from eventopia.services.session import SessionService
from eventopia.telegram.webapp import validate_init_data


class AuthService:
    def __init__(
        self,
        account_service: AccountService,
        session_service: SessionService,
        otp_service: OtpService,
        telegram_config: TelegramSection,
        auth_config: AuthSection,
    ) -> None:
        self._account_service = account_service
        self._session_service = session_service
        self._otp_service = otp_service
        self._telegram_config = telegram_config
        self._config = auth_config

    async def request_otp(self, phone: str, ip: str | None) -> RetryOut:
        retry = await self._otp_service.request_code(phone, ip)
        return RetryOut(retry_after_seconds=retry)

    async def login_with_otp(
        self, phone: str, code: str, user_agent: str | None, ip: str | None
    ) -> tuple[LoginOut, str]:
        uid = await self._otp_service.verify_code(phone, code)
        profile = await self._account_service.ensure_profile(uid)
        # Precompute the response before committing a new browser credential.
        result = self._login(profile)
        try:
            raw = await self._session_service.create_refresh(
                uid,
                user_agent,
                ip,
                expected_phone=normalize_phone(
                    phone, self._config["default_phone_region"]
                ),
            )
        except AuthError:
            raise InvalidCodeError() from None
        return result, raw

    async def login_with_webapp(self, init_data: str) -> LoginOut:
        user = validate_init_data(
            init_data,
            self._telegram_config["bot_token"],
            self._config["webapp_init_data_max_age_seconds"],
            int(datetime.now(UTC).timestamp()),
        )
        uid = await self._account_service.get_telegram_login_uid(user.id)
        profile = await self._account_service.ensure_profile(uid)
        # Recheck after external graph I/O; no await separates this from issuance.
        if await self._account_service.get_telegram_login_uid(user.id) != uid:
            raise AuthError()
        return self._login(profile)

    async def refresh(self, raw: str | None) -> tuple[AccessOut, str | None]:
        if not raw:
            raise AuthError()
        uid = await self._session_service.get_refresh_uid(raw)
        profile = await self._account_service.ensure_profile(uid)
        result = AccessOut(
            access_token=self._session_service.issue_access_token(uid, profile.username)
        )
        # The write transaction revalidates the session/account after graph I/O.
        outcome = await self._session_service.rotate_refresh(raw)
        return result, outcome.new_refresh_token

    async def logout(self, raw: str | None) -> None:
        await self._session_service.revoke_refresh(raw)

    async def authenticate(self, bearer: str | None) -> AccessClaims:
        parts = bearer.split() if bearer else []
        if len(parts) != 2 or parts[0].lower() != "bearer":
            raise AuthError()
        claims = self._session_service.verify_access_token(parts[1])
        if not await self._account_service.is_account_active(claims.uid):
            raise AuthError()
        return claims

    async def me(self, uid: str) -> MeOut:
        profile = await self._account_service.ensure_profile(uid)
        phone = await self._account_service.get_verified_phone(uid)
        return MeOut(
            **MeOut.model_validate(profile).model_dump(exclude={"phone_masked"}),
            phone_masked=mask_phone(phone) if phone else None,
        )

    def _login(self, profile: UserProfile) -> LoginOut:
        return LoginOut(
            access_token=self._session_service.issue_access_token(
                profile.uid, profile.username
            ),
            user=UserOut.model_validate(profile),
        )
