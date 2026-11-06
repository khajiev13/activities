from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class AccountRecord:
    uid: str
    status: str
    created_at: datetime


@dataclass
class TelegramIdentityRecord:
    account_uid: str
    telegram_user_id: int
    chat_id: int
    phone_e164: str | None = field(repr=False)
    phone_verified_at: datetime | None
    username: str | None
    first_name: str | None
    last_name: str | None
    language_code: str | None
    chat_active: bool
    chat_status_changed_at: datetime
    updated_at: datetime


@dataclass
class OtpChallengeRecord:
    id: str
    phone_e164: str = field(repr=False)
    account_uid: str | None
    code_hash: str = field(repr=False)
    created_at: datetime
    expires_at: datetime
    attempts: int
    consumed_at: datetime | None
    superseded_at: datetime | None
    requester_ip: str
    delivered: bool


@dataclass
class RefreshSessionRecord:
    id: str
    account_uid: str
    family_id: str
    token_hash: str = field(repr=False)
    issued_at: datetime
    expires_at: datetime
    revoked_at: datetime | None
    replaced_by: str | None
    user_agent: str | None
    ip: str


@dataclass
class TelegramUser:
    id: int
    username: str | None
    first_name: str
    last_name: str | None = None
    language_code: str | None = None


@dataclass
class SharedContact:
    user_id: int | None
    phone_number: str = field(repr=False)


@dataclass
class RegistrationResult:
    uid: str
    username: str
    phone_e164: str = field(repr=False)
    is_new: bool


@dataclass
class UserProfile:
    uid: str
    username: str
    first_name: str | None
    last_name: str | None
    image_url: str | None
    gender: str | None
    birth_date: str | None


@dataclass
class AccessClaims:
    uid: str
    username: str


@dataclass
class RotateOutcome:
    uid: str
    new_refresh_token: str | None = field(repr=False)
