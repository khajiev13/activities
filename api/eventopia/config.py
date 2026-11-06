from pathlib import Path
from typing import TypedDict, cast

import yaml


class AppSection(TypedDict):
    public_base_url: str
    cors_origins: list[str]
    log_level: str


class Neo4jSection(TypedDict):
    uri: str
    user: str
    password: str
    database: str


class SqliteSection(TypedDict):
    path: str


class AuthSection(TypedDict):
    jwt_secret: str
    access_ttl_seconds: int
    refresh_ttl_days: int
    refresh_reuse_grace_seconds: int
    refresh_cookie_name: str
    cookie_secure: bool
    otp_pepper: str
    otp_ttl_seconds: int
    otp_max_attempts: int
    otp_resend_seconds: int
    otp_max_per_phone_per_hour: int
    otp_max_per_ip_per_hour: int
    webapp_init_data_max_age_seconds: int
    default_phone_region: str


class TelegramSection(TypedDict):
    bot_token: str
    bot_username: str
    poll_timeout_seconds: int


class S3Section(TypedDict):
    endpoint_url: str
    access_key: str
    secret_key: str
    bucket: str
    region: str
    public_prefix: str
    max_upload_bytes: int


class AppConfig(TypedDict):
    app: AppSection
    neo4j: Neo4jSection
    sqlite: SqliteSection
    auth: AuthSection
    telegram: TelegramSection
    s3: S3Section


class ConfigError(Exception):
    pass


def load_config(path: str) -> AppConfig:
    try:
        with Path(path).open(encoding="utf-8") as config_file:
            config = yaml.safe_load(config_file)
    except (OSError, UnicodeError, yaml.YAMLError):
        raise ConfigError("Unable to read configuration YAML") from None

    if not isinstance(config, dict):
        raise ConfigError("Configuration must be a mapping")

    sections = {
        "app": AppSection,
        "neo4j": Neo4jSection,
        "sqlite": SqliteSection,
        "auth": AuthSection,
        "telegram": TelegramSection,
        "s3": S3Section,
    }
    missing = []
    for name, section_type in sections.items():
        section = config.get(name)
        for key in sorted(section_type.__required_keys__):
            if not isinstance(section, dict) or section.get(key) is None:
                missing.append(f"{name}.{key}")
    if missing:
        raise ConfigError("Missing required configuration keys: " + ", ".join(missing))
    return cast(AppConfig, config)
