"""Create the SQLite identity and authentication store."""

import sqlalchemy as sa
from alembic import op

revision = "0001_auth_store"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "accounts",
        sa.Column("uid", sa.Text(), primary_key=True),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.CheckConstraint("status IN ('active', 'disabled')", name="account_status"),
    )
    op.create_table(
        "telegram_identities",
        sa.Column(
            "account_uid",
            sa.Text(),
            sa.ForeignKey("accounts.uid"),
            nullable=False,
            unique=True,
        ),
        sa.Column("telegram_user_id", sa.Integer(), nullable=False, unique=True),
        sa.Column("chat_id", sa.Integer(), nullable=False),
        sa.Column("phone_e164", sa.Text(), unique=True),
        sa.Column("phone_verified_at", sa.DateTime()),
        sa.Column("username", sa.Text()),
        sa.Column("first_name", sa.Text()),
        sa.Column("last_name", sa.Text()),
        sa.Column("language_code", sa.Text()),
        sa.Column("chat_active", sa.Boolean(), nullable=False),
        sa.Column("chat_status_changed_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_table(
        "otp_challenges",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column("phone_e164", sa.Text(), nullable=False),
        sa.Column("account_uid", sa.Text()),
        sa.Column("code_hash", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("consumed_at", sa.DateTime()),
        sa.Column("superseded_at", sa.DateTime()),
        sa.Column("requester_ip", sa.Text(), nullable=False),
        sa.Column("delivered", sa.Boolean(), nullable=False),
    )
    op.create_table(
        "refresh_sessions",
        sa.Column("id", sa.Text(), primary_key=True),
        sa.Column(
            "account_uid", sa.Text(), sa.ForeignKey("accounts.uid"), nullable=False
        ),
        sa.Column("family_id", sa.Text(), nullable=False),
        sa.Column("token_hash", sa.Text(), nullable=False, unique=True),
        sa.Column("issued_at", sa.DateTime(), nullable=False),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("revoked_at", sa.DateTime()),
        sa.Column("replaced_by", sa.Text()),
        sa.Column("user_agent", sa.Text()),
        sa.Column("ip", sa.Text(), nullable=False),
    )
    op.create_table(
        "bot_state",
        sa.Column("key", sa.Text(), primary_key=True),
        sa.Column("value", sa.Text(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("bot_state")
    op.drop_table("refresh_sessions")
    op.drop_table("otp_challenges")
    op.drop_table("telegram_identities")
    op.drop_table("accounts")
