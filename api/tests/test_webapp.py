import hashlib
import hmac
import json
from secrets import token_urlsafe
from urllib.parse import parse_qsl, urlencode

import pytest

from eventopia.exceptions import AuthError
from eventopia.telegram.webapp import validate_init_data

_NOW = 1800000000


@pytest.fixture
def bot_token():
    return token_urlsafe(32)


def _fields(**changes):
    return {
        "auth_date": str(_NOW),
        "query_id": "test-query",
        "user": json.dumps({"id": 7, "first_name": "Ali"}),
        **changes,
    }


def _sign(fields, bot_token):
    # Independent implementation, following Telegram's bot-token HMAC algorithm.
    check = "\n".join(f"{key}={value}" for key, value in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    signature = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return urlencode([*fields.items(), ("hash", signature)])


def test_init_data_valid_optional_fields_and_unknown_signed_field(bot_token):
    fields = _fields(
        user=json.dumps(
            {
                "id": 7,
                "first_name": "Ali + & 炎",
                "last_name": "Valiyev",
                "username": "ali",
                "language_code": "uz",
                "is_premium": True,
            }
        ),
        signature="signed-extra",
    )
    user = validate_init_data(_sign(fields, bot_token), bot_token, 86400, _NOW)
    assert (
        user.id,
        user.first_name,
        user.last_name,
        user.username,
        user.language_code,
    ) == (7, "Ali + & 炎", "Valiyev", "ali", "uz")


def test_init_data_minimal_user(bot_token):
    user = validate_init_data(_sign(_fields(), bot_token), bot_token, 86400, _NOW)
    assert user.id == 7
    assert user.username is None and user.last_name is None
    assert user.language_code is None


def test_init_data_constant_time_comparison(bot_token, monkeypatch):
    original = hmac.compare_digest
    calls = []

    def compare(left, right):
        calls.append(True)
        return original(left, right)

    monkeypatch.setattr(hmac, "compare_digest", compare)
    validate_init_data(_sign(_fields(), bot_token), bot_token, 86400, _NOW)
    assert len(calls) == 1


def test_init_data_tampered_and_wrong_token(bot_token):
    signed = _sign(_fields(), bot_token)
    pairs = dict(parse_qsl(signed))
    pairs["user"] = json.dumps({"id": 8, "first_name": "Ali"})
    for data, token in ((urlencode(pairs), bot_token), (signed, token_urlsafe(32))):
        with pytest.raises(AuthError):
            validate_init_data(data, token, 86400, _NOW)


@pytest.mark.parametrize("age", [0, 86400])
def test_init_data_max_age_boundary(bot_token, age):
    validate_init_data(
        _sign(_fields(auth_date=str(_NOW - age)), bot_token), bot_token, 86400, _NOW
    )


@pytest.mark.parametrize(
    "date",
    [str(_NOW - 86401), str(_NOW + 1), "", "abc", "1.5", "-1", " true", "+1800000000"],
)
def test_init_data_rejects_expired_future_and_malformed_dates(bot_token, date):
    with pytest.raises(AuthError):
        validate_init_data(
            _sign(_fields(auth_date=date), bot_token), bot_token, 86400, _NOW
        )


@pytest.mark.parametrize("missing", ["hash", "auth_date", "user"])
def test_init_data_missing_required_field(bot_token, missing):
    pairs = dict(parse_qsl(_sign(_fields(), bot_token)))
    del pairs[missing]
    # Missing data fields are re-signed, so this tests required-field validation.
    if missing != "hash":
        pairs.pop("hash")
        data = _sign(pairs, bot_token)
    else:
        data = urlencode(pairs)
    with pytest.raises(AuthError):
        validate_init_data(data, bot_token, 86400, _NOW)


@pytest.mark.parametrize(
    "user",
    [
        "null",
        "[]",
        "7",
        "{",
        "{}",
        '{"id":7}',
        '{"id":true,"first_name":"Ali"}',
        '{"id":"7","first_name":"Ali"}',
        '{"id":7,"first_name":null}',
        '{"id":7,"first_name":"Ali","username":7}',
        '{"id":7,"id":8,"first_name":"Ali"}',
    ],
)
def test_init_data_rejects_invalid_user_json(bot_token, user):
    with pytest.raises(AuthError):
        validate_init_data(_sign(_fields(user=user), bot_token), bot_token, 86400, _NOW)


@pytest.mark.parametrize(
    "suffix",
    [
        "&hash=duplicate",
        "&auth_date=1800000000",
        "&user=duplicate",
        "&query_id=duplicate",
        "&broken",
        "&bad=%ZZ",
        "&bad=%FF",
    ],
)
def test_init_data_rejects_ambiguous_or_malformed_query(bot_token, suffix):
    with pytest.raises(AuthError):
        validate_init_data(_sign(_fields(), bot_token) + suffix, bot_token, 86400, _NOW)


@pytest.mark.parametrize("hash_value", ["", "a" * 63, "g" * 64, "炎" * 64])
def test_init_data_rejects_malformed_hash(bot_token, hash_value):
    pairs = dict(parse_qsl(_sign(_fields(), bot_token)))
    pairs["hash"] = hash_value
    with pytest.raises(AuthError):
        validate_init_data(urlencode(pairs), bot_token, 86400, _NOW)
