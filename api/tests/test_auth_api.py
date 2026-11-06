import asyncio
import hashlib
import hmac
import json
import re
from datetime import UTC, datetime, timedelta
from secrets import randbelow, token_urlsafe
from urllib.parse import urlencode
from uuid import UUID

import httpx
import pytest
from sqlalchemy import func, select, update

from eventopia import create_app
from eventopia.models.auth import SharedContact, TelegramUser
from eventopia.phone import mask_phone
from eventopia.sqls.tables import accounts, refresh_sessions
from eventopia.telegram.fake import FakeTelegramGateway
from eventopia.telegram.gateway import TelegramApiError
from eventopia.wiring import build_container


def check(condition, message):
    # Avoid assertion introspection of credentials or PII.
    if not condition:
        pytest.fail(message, pytrace=False)


@pytest.fixture
async def env(config, sqlite_connector, neo4j_connector, neo4j_config):
    config["sqlite"]["path"] = str(sqlite_connector._engine.url.database)
    config["auth"]["jwt_secret"] = token_urlsafe(48)
    config["auth"]["otp_pepper"] = token_urlsafe(48)
    config["telegram"]["bot_token"] = token_urlsafe(48)
    gateway = FakeTelegramGateway()
    config["neo4j"] = neo4j_config
    container = build_container(config, telegram=gateway)
    phone = "+99890" + f"{randbelow(10**7):07d}"
    registered = await container.account_service.register_from_contact(
        TelegramUser(7, "synthetic_user", "Synthetic"), SharedContact(7, phone), 7
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(
            app=create_app(container), raise_app_exceptions=False
        ),
        base_url="http://test",
    ) as client:
        yield container, client, gateway, registered, config
    await container.close()


def signed(config, uid=7):
    fields = {
        "auth_date": str(int(datetime.now(UTC).timestamp())),
        "user": json.dumps({"id": uid, "first_name": "Synthetic"}),
    }
    secret = hmac.new(
        b"WebAppData", config["telegram"]["bot_token"].encode(), hashlib.sha256
    ).digest()
    data = "\n".join(f"{k}={fields[k]}" for k in sorted(fields))
    fields["hash"] = hmac.new(secret, data.encode(), hashlib.sha256).hexdigest()
    return urlencode(fields)


async def login(env):
    _, client, gateway, registered, _ = env
    response = await client.post(
        "/api/auth/otp/request", json={"phone": registered.phone_e164}
    )
    check(response.status_code == 200, "OTP request failed")
    code = re.search(r"\b[0-9]{6}\b", gateway.sent[-1].text).group()
    response = await client.post(
        "/api/auth/otp/verify", json={"phone": registered.phone_e164, "code": code}
    )
    check(response.status_code == 200, "OTP login failed")
    return response


async def count(container):
    async with container.sqlite.session() as s:
        return (
            await s.execute(select(func.count()).select_from(refresh_sessions))
        ).scalar()


async def test_otp_cookie_envelope_and_me(env, caplog):
    container, client, _, registered, _ = env
    response = await login(env)
    data = response.json()["data"]
    check(set(data) == {"access_token", "user"}, "login keys differ")
    check(
        data["user"]
        == {
            "uid": registered.uid,
            "username": registered.username,
            "first_name": "Synthetic",
            "last_name": None,
            "image_url": None,
        },
        "Auth API contract mismatch (line 92)",
    )
    cookie = response.headers["set-cookie"].lower()
    check(
        all(
            x in cookie
            for x in (
                "eventopia_refresh=",
                "httponly",
                "samesite=strict",
                "path=/api/auth",
                "max-age=2592000",
            )
        ),
        "cookie flags differ",
    )
    check(
        UUID(response.json()["requestId"]).version == 4,
        "Auth API contract mismatch (line 113)",
    )
    check(
        response.json()["requestId"] == response.headers["X-Request-ID"],
        "Auth API contract mismatch (line 114)",
    )
    response = await client.get(
        "/api/users/me", headers={"Authorization": "Bearer " + data["access_token"]}
    )
    check(response.status_code == 200, "Auth API contract mismatch (line 118)")
    check(
        response.json()["data"]["phone_masked"] == mask_phone(registered.phone_e164),
        "phone mask differs",
    )
    check(
        set(response.json()["data"])
        == {
            "uid",
            "username",
            "first_name",
            "last_name",
            "image_url",
            "gender",
            "birth_date",
            "phone_masked",
        },
        "Auth API contract mismatch (line 123)",
    )
    check(
        registered.phone_e164 not in response.text + caplog.text
        and data["access_token"] not in caplog.text,
        "private data disclosed",
    )
    check(
        "eventopia_refresh" not in response.request.headers.get("cookie", ""),
        "cookie escaped auth path",
    )
    check(await count(container) == 1, "Auth API contract mismatch (line 142)")


async def test_secure_cookie(env):
    env[4]["auth"]["cookie_secure"] = True
    check(
        "secure" in (await login(env)).headers["set-cookie"].lower(), "Secure missing"
    )


@pytest.mark.parametrize("path", ["/api/auth/refresh", "/api/auth/logout"])
@pytest.mark.parametrize("header", [None, "wrong", "Eventopia"])
async def test_xrw_required(env, path, header):
    response = await env[1].post(
        path, headers={} if header is None else {"X-Requested-With": header}
    )
    check(
        response.status_code == 403 and response.json()["error"] == 104,
        "Auth API contract mismatch (line 158)",
    )


async def test_refresh_reload_logout(env):
    _, client, _, _, _ = env
    await login(env)
    old = client.cookies.get("eventopia_refresh")
    headers = {"X-Requested-With": "eventopia"}
    response = await client.post("/api/auth/refresh", headers=headers)
    check(
        response.status_code == 200
        and set(response.json()["data"]) == {"access_token"},
        "Auth API contract mismatch (line 167)",
    )
    check(client.cookies.get("eventopia_refresh") != old, "cookie did not rotate")
    response = await client.post("/api/auth/refresh", headers=headers)
    access = response.json()["data"]["access_token"]
    check(
        (
            await client.get(
                "/api/users/me", headers={"Authorization": "Bearer " + access}
            )
        ).status_code
        == 200,
        "Auth API contract mismatch (line 173)",
    )
    current = client.cookies.get("eventopia_refresh")
    response = await client.post("/api/auth/logout", headers=headers)
    check(
        response.json()["data"] == {} and response.status_code == 200,
        "Auth API contract mismatch (line 178)",
    )
    check("max-age=0" in response.headers["set-cookie"].lower(), "cookie not cleared")
    for raw in (None, current, old):
        cookie = {"cookie": "eventopia_refresh=" + raw} if raw else {}
        response = await client.post("/api/auth/refresh", headers={**headers, **cookie})
        check(
            response.status_code == 401 and response.json()["error"] == 101,
            "Auth API contract mismatch (line 183)",
        )
    check(
        (await client.post("/api/auth/logout", headers=headers)).status_code == 200,
        "Auth API contract mismatch (line 184)",
    )


async def test_simultaneous_refresh(env):
    container, client, _, _, _ = env
    await login(env)
    headers = {
        "X-Requested-With": "eventopia",
        "cookie": "eventopia_refresh=" + client.cookies.get("eventopia_refresh"),
    }
    responses = await asyncio.gather(
        *(client.post("/api/auth/refresh", headers=headers) for _ in range(5))
    )
    check(
        [r.status_code for r in responses] == [200] * 5,
        "Auth API contract mismatch (line 197)",
    )
    check(
        sum("set-cookie" in r.headers for r in responses) == 1,
        "Auth API contract mismatch (line 198)",
    )
    check(await count(container) == 2, "Auth API contract mismatch (line 199)")


@pytest.mark.parametrize("cookie", [None, "", "random"])
async def test_bad_refresh(env, cookie):
    headers = {"X-Requested-With": "eventopia"}
    if cookie is not None:
        headers["cookie"] = "eventopia_refresh=" + (token_urlsafe(32) if cookie else "")
    response = await env[1].post("/api/auth/refresh", headers=headers)
    check(
        response.status_code == 401 and response.json()["error"] == 101,
        "Auth API contract mismatch (line 208)",
    )


async def test_webapp_access_only_phone_required(env):
    container, client, _, registered, config = env
    response = await client.post(
        "/api/auth/telegram/webapp", json={"init_data": signed(config)}
    )
    check(
        response.status_code == 200 and "set-cookie" not in response.headers,
        "Auth API contract mismatch (line 216)",
    )
    check(
        set(response.json()["data"]) == {"access_token", "user"}, "webapp keys differ"
    )
    check(
        response.json()["data"]["user"]["uid"] == registered.uid,
        "Auth API contract mismatch (line 220)",
    )
    check(await count(container) == 0, "Auth API contract mismatch (line 221)")
    response = await client.post(
        "/api/auth/telegram/webapp", json={"init_data": signed(config, 8)}
    )
    check(
        response.status_code == 403 and response.json()["error"] == 103,
        "Auth API contract mismatch (line 225)",
    )


@pytest.mark.parametrize("kind", ["tampered", "empty", "object", "missing"])
async def test_bad_webapp_safe(env, kind, caplog):
    raw = signed(env[4]) + token_urlsafe(16)
    body = (
        {"init_data": {"private": raw}}
        if kind == "object"
        else {"init_data": "" if kind == "empty" else raw}
    )
    if kind == "missing":
        body = {"private": raw}
    response = await env[1].post("/api/auth/telegram/webapp", json=body)
    check(
        response.status_code == (422 if kind in ("object", "missing") else 401),
        "Auth API contract mismatch (line 239)",
    )
    check(raw not in response.text + caplog.text, "initData disclosed")


@pytest.mark.parametrize(
    "auth", [None, "", "Bearer", "Basic abc", "Bearer broken", "Bearer a b"]
)
async def test_bad_bearer(env, auth):
    response = await env[1].get(
        "/api/users/me", headers={} if auth is None else {"Authorization": auth}
    )
    check(
        response.status_code == 401 and response.json()["error"] == 101,
        "Auth API contract mismatch (line 250)",
    )


async def test_disabled_cannot_login_refresh_authenticate(env):
    container, client, _, registered, config = env
    access = (await login(env)).json()["data"]["access_token"]
    check(
        (
            await client.get(
                "/api/users/me", headers={"Authorization": "Bearer " + access}
            )
        ).status_code
        == 200,
        "Auth API contract mismatch (line 256)",
    )
    async with container.sqlite.session(write=True) as s:
        await s.execute(
            update(accounts)
            .where(accounts.c.uid == registered.uid)
            .values(status="disabled")
        )
    response = await client.post(
        "/api/auth/telegram/webapp", json={"init_data": signed(config)}
    )
    check(
        response.status_code == 401 and response.json()["error"] == 101,
        "Auth API contract mismatch (line 268)",
    )
    response = await client.post(
        "/api/auth/refresh", headers={"X-Requested-With": "eventopia"}
    )
    check(
        response.status_code == 401 and response.json()["error"] == 101,
        "Auth API contract mismatch (line 272)",
    )
    container.account_service._active_cache.clear()
    check(
        (
            await client.get(
                "/api/users/me", headers={"Authorization": "Bearer " + access}
            )
        ).status_code
        == 401,
        "Auth API contract mismatch (line 274)",
    )
    code = re.search(r"\b[0-9]{6}\b", env[2].sent[-1].text).group()
    response = await client.post(
        "/api/auth/otp/verify", json={"phone": registered.phone_e164, "code": code}
    )
    check(
        response.status_code == 401 and response.json()["error"] == 102,
        "Auth API contract mismatch (line 281)",
    )


async def test_otp_request_indistinguishable(env, monkeypatch):
    container, client, gateway, registered, _ = env
    unknown = "+99891" + f"{randbelow(10**7):07d}"
    responses = []
    for phone in (registered.phone_e164, unknown):
        responses.append(
            await client.post("/api/auth/otp/request", json={"phone": phone})
        )
    container.otp_service._clock = lambda: datetime.now(UTC) + timedelta(seconds=61)

    async def failure(*args, **kwargs):
        raise TelegramApiError("Synthetic failure")

    monkeypatch.setattr(gateway, "send_message", failure)
    responses.append(
        await client.post(
            "/api/auth/otp/request", json={"phone": registered.phone_e164}
        )
    )
    bodies = [
        {k: v for k, v in r.json().items() if k != "requestId"} for r in responses
    ]
    check(
        [r.status_code for r in responses] == [200] * 3,
        "Auth API contract mismatch (line 306)",
    )
    check(
        bodies == [{"error": 0, "data": {"retry_after_seconds": 60}}] * 3,
        "Auth API contract mismatch (line 307)",
    )
    response = await client.post(
        "/api/auth/otp/request", json={"phone": registered.phone_e164}
    )
    check(
        response.status_code == 429 and response.json()["error"] == 202,
        "Auth API contract mismatch (line 311)",
    )


@pytest.mark.parametrize(
    "body,status,code", [({"phone": "bad"}, 422, 201), ({}, 422, 200)]
)
async def test_invalid_otp_request(env, body, status, code):
    response = await env[1].post("/api/auth/otp/request", json=body)
    check(
        response.status_code == status and response.json()["error"] == code,
        "Auth API contract mismatch (line 319)",
    )


@pytest.mark.parametrize(
    "phone,code", [("bad", "bad"), ("+998901234567", ""), ("+998901234567", "123456")]
)
async def test_bad_otp_generic(env, phone, code):
    response = await env[1].post(
        "/api/auth/otp/verify", json={"phone": phone, "code": code}
    )
    check(
        response.status_code == 401 and response.json()["error"] == 102,
        "Auth API contract mismatch (line 329)",
    )


@pytest.mark.parametrize(
    "path,method",
    [
        ("/api/auth/otp/request/", "post"),
        ("/api/auth/otp/verify/", "post"),
        ("/api/auth/telegram/webapp/", "post"),
        ("/api/auth/refresh/", "post"),
        ("/api/auth/logout/", "post"),
        ("/api/users/me/", "get"),
    ],
)
async def test_no_redirects(env, path, method):
    response = await getattr(env[1], method)(path)
    check(
        response.status_code == 404 and response.json()["error"] == 300,
        "Auth API contract mismatch (line 345)",
    )


async def test_takeover_after_verification_cannot_issue_refresh(env, monkeypatch):
    container, client, gateway, registered, _ = env
    await client.post("/api/auth/otp/request", json={"phone": registered.phone_e164})
    code = re.search(r"\b[0-9]{6}\b", gateway.sent[-1].text).group()
    original = container.account_service.ensure_profile

    async def take_over(uid):
        monkeypatch.setattr(container.account_service, "ensure_profile", original)
        await container.account_service.register_from_contact(
            TelegramUser(8, "new_owner", "New"),
            SharedContact(8, registered.phone_e164),
            8,
        )
        return await original(uid)

    monkeypatch.setattr(container.account_service, "ensure_profile", take_over)
    response = await client.post(
        "/api/auth/otp/verify", json={"phone": registered.phone_e164, "code": code}
    )
    check(
        response.status_code == 401 and response.json()["error"] == 102,
        "Auth API contract mismatch (line 367)",
    )
    check(
        "set-cookie" not in response.headers and await count(container) == 0,
        "Auth API contract mismatch (line 368)",
    )


async def test_profile_failure_preserves_refresh(env, monkeypatch):
    container, client, _, _, _ = env
    await login(env)
    original = container.account_service.ensure_profile

    async def failure(uid):
        raise RuntimeError("Synthetic profile outage")

    monkeypatch.setattr(container.account_service, "ensure_profile", failure)
    response = await client.post(
        "/api/auth/refresh", headers={"X-Requested-With": "eventopia"}
    )
    check(
        response.status_code == 500 and "set-cookie" not in response.headers,
        "Auth API contract mismatch (line 383)",
    )
    check(await count(container) == 1, "Auth API contract mismatch (line 384)")
    monkeypatch.setattr(container.account_service, "ensure_profile", original)
    check(
        (
            await client.post(
                "/api/auth/refresh", headers={"X-Requested-With": "eventopia"}
            )
        ).status_code
        == 200,
        "Auth API contract mismatch (line 386)",
    )


async def test_old_replay_revokes_family_before_profile_io(env, monkeypatch):
    container, client, _, _, _ = env
    await login(env)
    old = client.cookies.get("eventopia_refresh")
    headers = {"X-Requested-With": "eventopia"}
    check(
        (await client.post("/api/auth/refresh", headers=headers)).status_code == 200,
        "Auth API contract mismatch (line 398)",
    )
    current = client.cookies.get("eventopia_refresh")
    clock = container.session_service._clock
    container.session_service._clock = lambda: clock() + timedelta(seconds=31)
    calls = []

    async def failure(uid):
        calls.append(uid)
        raise RuntimeError("Synthetic graph failure")

    monkeypatch.setattr(container.account_service, "ensure_profile", failure)
    response = await client.post(
        "/api/auth/refresh", headers={**headers, "cookie": "eventopia_refresh=" + old}
    )
    check(
        response.status_code == 401 and response.json()["error"] == 101,
        "Auth API contract mismatch (line 412)",
    )
    check(calls == [], "Auth API contract mismatch (line 413)")
    response = await client.post(
        "/api/auth/refresh",
        headers={**headers, "cookie": "eventopia_refresh=" + current},
    )
    check(
        response.status_code == 401 and calls == [],
        "Auth API contract mismatch (line 418)",
    )


@pytest.mark.parametrize("change", ["phone", "disabled"])
async def test_webapp_rechecks_identity_after_profile(env, monkeypatch, change):
    from eventopia.sqls import telegram

    container, client, _, registered, config = env
    original = container.account_service.ensure_profile

    async def changed_profile(uid):
        profile = await original(uid)
        async with container.sqlite.session(write=True) as s:
            if change == "phone":
                await telegram.set_identity_phone(s, 7, None, None, datetime.now(UTC))
            else:
                await s.execute(
                    update(accounts)
                    .where(accounts.c.uid == registered.uid)
                    .values(status="disabled")
                )
        return profile

    monkeypatch.setattr(container.account_service, "ensure_profile", changed_profile)
    response = await client.post(
        "/api/auth/telegram/webapp", json={"init_data": signed(config)}
    )
    check(
        response.status_code == (403 if change == "phone" else 401),
        "Auth API contract mismatch (line 445)",
    )
    check(
        response.json()["error"] == (103 if change == "phone" else 101),
        "Auth API contract mismatch (line 446)",
    )
    check(
        "set-cookie" not in response.headers and await count(container) == 0,
        "Auth API contract mismatch (line 447)",
    )


async def test_cookie_samesite_wire_case(env):
    response = await login(env)
    check(
        "SameSite=Strict" in response.headers["set-cookie"],
        "SameSite wire case differs",
    )


async def test_logout_while_refresh_waits_for_profile_cannot_recreate_session(
    env, monkeypatch
):
    container, client, _, _, _ = env
    await login(env)
    original = container.account_service.ensure_profile
    entered, release = asyncio.Event(), asyncio.Event()

    async def delayed_profile(uid):
        profile = await original(uid)
        entered.set()
        await release.wait()
        return profile

    monkeypatch.setattr(container.account_service, "ensure_profile", delayed_profile)
    headers = {"X-Requested-With": "eventopia"}
    refreshing = asyncio.create_task(client.post("/api/auth/refresh", headers=headers))
    try:
        await asyncio.wait_for(entered.wait(), timeout=5)
        response = await client.post("/api/auth/logout", headers=headers)
        check(response.status_code == 200, "Auth API contract mismatch (line 478)")
    finally:
        release.set()
    response = await refreshing
    check(
        response.status_code == 401 and "set-cookie" not in response.headers,
        "Auth API contract mismatch (line 482)",
    )
    check(await count(container) == 1, "Auth API contract mismatch (line 483)")
    response = await client.post("/api/auth/refresh", headers=headers)
    check(response.status_code == 401, "Auth API contract mismatch (line 485)")
