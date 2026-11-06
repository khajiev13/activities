from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from secrets import token_urlsafe
from uuid import uuid4

import jwt

from eventopia.config import AuthSection
from eventopia.context.sqlite import SqliteConnector
from eventopia.exceptions import AuthError
from eventopia.models.auth import AccessClaims, RefreshSessionRecord, RotateOutcome
from eventopia.sqls import sessions


def utcnow() -> datetime:
    return datetime.now(UTC)


class SessionService:
    def __init__(
        self,
        sqlite: SqliteConnector,
        auth_config: AuthSection,
        clock: Callable[[], datetime] = utcnow,
    ) -> None:
        self._sqlite = sqlite
        self._config = auth_config
        self._clock = clock

    def issue_access_token(self, uid: str, username: str) -> str:
        now = self._clock()
        return jwt.encode(
            {
                "sub": uid,
                "username": username,
                "typ": "access",
                "iat": now,
                "exp": now + timedelta(seconds=self._config["access_ttl_seconds"]),
            },
            self._config["jwt_secret"],
            algorithm="HS256",
        )

    def verify_access_token(self, token: str) -> AccessClaims:
        try:
            claims = jwt.decode(
                token,
                self._config["jwt_secret"],
                algorithms=["HS256"],
                options={
                    "require": ["sub", "username", "typ", "iat", "exp"],
                    "verify_exp": False,
                    "verify_iat": False,
                    "verify_nbf": False,
                },
            )
        except jwt.InvalidTokenError:
            raise AuthError() from None
        now = self._clock().timestamp()
        if (
            claims["typ"] != "access"
            or not isinstance(claims["sub"], str)
            or not claims["sub"]
            or not isinstance(claims["username"], str)
            or type(claims["iat"]) is not int
            or type(claims["exp"]) is not int
            or claims["iat"] > now
            or claims["exp"] <= now
        ):
            raise AuthError()
        return AccessClaims(uid=claims["sub"], username=claims["username"])

    async def create_refresh(
        self, uid: str, user_agent: str | None, ip: str | None
    ) -> str:
        raw, record = self._new_refresh(uid, str(uuid4()), user_agent, ip)
        async with self._sqlite.session(write=True) as s:
            await sessions.insert_session(s, record)
        return raw

    async def rotate_refresh(self, raw: str) -> RotateOutcome:
        outcome = None
        async with self._sqlite.session(write=True) as s:
            now = self._clock()
            record = await sessions.select_session_by_hash(s, _hash(raw))
            if record is not None:
                if record.revoked_at is None and record.expires_at > now:
                    new_raw, new_record = self._new_refresh(
                        record.account_uid,
                        record.family_id,
                        record.user_agent,
                        record.ip,
                    )
                    await sessions.insert_session(s, new_record)
                    await sessions.revoke_session(s, record.id, now, new_record.id)
                    outcome = RotateOutcome(record.account_uid, new_raw)
                elif record.revoked_at is not None and record.replaced_by is not None:
                    grace = timedelta(
                        seconds=self._config["refresh_reuse_grace_seconds"]
                    )
                    if (
                        record.expires_at > now
                        and now - record.revoked_at <= grace
                        and await sessions.has_live_family(s, record.family_id, now)
                    ):
                        outcome = RotateOutcome(record.account_uid, None)
                    else:
                        await sessions.revoke_family(s, record.family_id, now)
        # Revocation must commit before the domain error leaves the transaction.
        if outcome is None:
            raise AuthError()
        return outcome

    async def revoke_refresh(self, raw: str | None) -> None:
        if raw is None:
            return
        async with self._sqlite.session(write=True) as s:
            record = await sessions.select_session_by_hash(s, _hash(raw))
            if record is not None:
                await sessions.logout_session(s, record.id, self._clock())

    def _new_refresh(
        self, uid: str, family_id: str, user_agent: str | None, ip: str | None
    ) -> tuple[str, RefreshSessionRecord]:
        raw = token_urlsafe(32)
        now = self._clock()
        return raw, RefreshSessionRecord(
            id=str(uuid4()),
            account_uid=uid,
            family_id=family_id,
            token_hash=_hash(raw),
            issued_at=now,
            expires_at=now + timedelta(days=self._config["refresh_ttl_days"]),
            revoked_at=None,
            replaced_by=None,
            user_agent=user_agent,
            ip=ip or "",
        )


def _hash(raw: str) -> str:
    return sha256(raw.encode()).hexdigest()
