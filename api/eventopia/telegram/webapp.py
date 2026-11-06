import hashlib
import hmac
import json
import re
from dataclasses import dataclass
from urllib.parse import parse_qsl

from eventopia.exceptions import AuthError


@dataclass
class WebAppUser:
    id: int
    username: str | None
    first_name: str
    last_name: str | None
    language_code: str | None


def validate_init_data(
    init_data: str,
    bot_token: str,
    max_age_seconds: int,
    now: int,
) -> WebAppUser:
    try:
        if re.search(r"%(?![0-9a-fA-F]{2})", init_data):
            raise ValueError
        pairs = parse_qsl(
            init_data,
            keep_blank_values=True,
            strict_parsing=True,
            encoding="utf-8",
            errors="strict",
        )
        fields = dict(pairs)
        if len(fields) != len(pairs) or not all(
            key and "\n" not in key + value and "\r" not in key + value
            for key, value in pairs
        ):
            raise ValueError
        received_hash = fields.pop("hash")
        if re.fullmatch(r"[0-9a-fA-F]{64}", received_hash) is None:
            raise ValueError
        # Telegram bot-token validation includes every received field except hash
        # (including signature); the separate third-party algorithm differs.
        check = "\n".join(f"{key}={fields[key]}" for key in sorted(fields))
        secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
        expected_hash = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected_hash, received_hash):
            raise ValueError
        date = fields["auth_date"]
        if re.fullmatch(r"[0-9]+", date) is None:
            raise ValueError
        age = now - int(date)
        if age < 0 or age > max_age_seconds:
            raise ValueError
        user = json.loads(fields["user"], object_pairs_hook=_unique_object)
        if not isinstance(user, dict) or type(user.get("id")) is not int:
            raise ValueError
        if not isinstance(user.get("first_name"), str):
            raise ValueError
        for key in ("username", "last_name", "language_code"):
            if key in user and not isinstance(user[key], str):
                raise ValueError
        return WebAppUser(
            id=user["id"],
            username=user.get("username"),
            first_name=user["first_name"],
            last_name=user.get("last_name"),
            language_code=user.get("language_code"),
        )
    except (KeyError, TypeError, ValueError, UnicodeError):
        raise AuthError("Invalid Telegram authentication data") from None


def _unique_object(pairs: list[tuple[str, object]]) -> dict:
    result = dict(pairs)
    if len(result) != len(pairs):
        raise ValueError
    return result
