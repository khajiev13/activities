from datetime import UTC, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    MetaData,
    Table,
    Text,
)
from sqlalchemy.types import TypeDecorator


class _UtcDateTime(TypeDecorator):
    """SQLite stores naive UTC; records always expose timezone-aware UTC."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: datetime | None, dialect) -> datetime | None:
        if value is None:
            return None
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Database timestamps must include a timezone")
        return value.astimezone(UTC).replace(tzinfo=None)

    def process_result_value(self, value: datetime | None, dialect) -> datetime | None:
        return value.replace(tzinfo=UTC) if value is not None else None


metadata = MetaData()

accounts = Table(
    "accounts",
    metadata,
    Column("uid", Text, primary_key=True),
    Column("status", Text, nullable=False),
    Column("created_at", _UtcDateTime, nullable=False),
    CheckConstraint("status IN ('active', 'disabled')", name="account_status"),
)

telegram_identities = Table(
    "telegram_identities",
    metadata,
    Column(
        "account_uid", Text, ForeignKey("accounts.uid"), nullable=False, unique=True
    ),
    Column("telegram_user_id", Integer, nullable=False, unique=True),
    Column("chat_id", Integer, nullable=False),
    Column("phone_e164", Text, unique=True),
    Column("phone_verified_at", _UtcDateTime),
    Column("username", Text),
    Column("first_name", Text),
    Column("last_name", Text),
    Column("language_code", Text),
    Column("chat_active", Boolean, nullable=False),
    Column("chat_status_changed_at", _UtcDateTime, nullable=False),
    Column("updated_at", _UtcDateTime, nullable=False),
)

otp_challenges = Table(
    "otp_challenges",
    metadata,
    Column("id", Text, primary_key=True),
    Column("phone_e164", Text, nullable=False),
    Column("account_uid", Text),
    Column("code_hash", Text, nullable=False),
    Column("created_at", _UtcDateTime, nullable=False),
    Column("expires_at", _UtcDateTime, nullable=False),
    Column("attempts", Integer, nullable=False),
    Column("consumed_at", _UtcDateTime),
    Column("superseded_at", _UtcDateTime),
    Column("requester_ip", Text, nullable=False),
    Column("delivered", Boolean, nullable=False),
)

refresh_sessions = Table(
    "refresh_sessions",
    metadata,
    Column("id", Text, primary_key=True),
    Column("account_uid", Text, ForeignKey("accounts.uid"), nullable=False),
    Column("family_id", Text, nullable=False),
    Column("token_hash", Text, nullable=False, unique=True),
    Column("issued_at", _UtcDateTime, nullable=False),
    Column("expires_at", _UtcDateTime, nullable=False),
    Column("revoked_at", _UtcDateTime),
    Column("replaced_by", Text),
    Column("user_agent", Text),
    Column("ip", Text, nullable=False),
)

bot_state = Table(
    "bot_state",
    metadata,
    Column("key", Text, primary_key=True),
    Column("value", Text, nullable=False),
)
