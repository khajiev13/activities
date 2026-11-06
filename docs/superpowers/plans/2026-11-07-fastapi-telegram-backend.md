# Eventopia FastAPI + Telegram Sign-in Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Django backend with a FastAPI service in `api/`.
- Telegram is the only identity: sign up in @eventopiarobot, log in on the website with a code the bot sends, or log in silently with Mini App `initData`.
- Auth data goes in SQLite, the graph in Neo4j and images in Silo.
- Make the existing React app work end to end against it.

**Architecture:**
- Layers follow the `python-service-patterns` skill: views (FastAPI routers built inside view classes) → services (plain classes, dependencies passed to the constructor) → data access. The data access is split into `cyphers/` (Neo4j, plain async driver) and `sqls/` (SQLite via SQLAlchemy async).
- `wiring.py` builds everything once at startup.
- A separate `bot_main.py` process long-polls Telegram.
- Every response is wrapped in the envelope `{requestId, error, data}`.

**Tech Stack:**
- Python 3.13 with uv; FastAPI 0.162.0; uvicorn 0.54.0; neo4j driver 6.4.1; SQLAlchemy 2.1.8 + aiosqlite 0.22.1 + Alembic 1.20.1.
- PyJWT 2.15.1, phonenumbers 9.0.43, httpx 0.28.1, boto3 1.43.x, PyYAML 6.0.3, python-multipart 0.0.33.
- Tests: pytest 9.2.0, pytest-asyncio 1.4.1.post1, testcontainers 4.15.0.
- Images: Neo4j `2026.10.1-community-trixie`, Silo `pgsty/silo:RELEASE.2026-10-26T00-00-00Z`.
- Frontend: React 18 / Vite 5 with vitest 3.2.7 and qrcode.react 4.2.0.

**Spec:** `docs/superpowers/specs/2026-11-07-fastapi-telegram-backend-design.md`. Read it fully before Task 1. Section numbers (§) below refer to it.

## Global Constraints

### Code and architecture
- **Python layout:**
  - Python 3.13. Package `eventopia` lives under `api/`. Dependency management is uv (`api/pyproject.toml` + `api/uv.lock`).
  - Pin exact versions as listed in Tech Stack. Re-check PyPI on Task 1. If a newer stable version exists, use it and note it in the commit message.
- **Skill rules** (from `python-service-patterns`):
  - Services never import FastAPI.
  - Views contain no business logic.
  - Only `wiring.py` constructs objects. There is no service locator.
  - Use a module-level `_logger` with `%`-style formatting.
  - Use the import order stdlib / third-party / local.
- **Never log:**
  - full phone numbers: use `mask_phone()`, which gives `+998 90 *** 4567`
  - OTP codes
  - access or refresh tokens
  - the bot token
  - `init_data`

### API
- **Response envelope:**
  - Success: `{"requestId": "<uuid4>", "error": 0, "data": <payload>}`.
  - Error: `{"requestId": "...", "error": <code>, "message": "<text>"}`, plus `"retry_after": <int>` for code 202.
  - Payload keys are snake_case.
- **Error codes:**

  | Code | HTTP | Meaning |
  |---|---|---|
  | 101 | 401 | Not authenticated or bad token |
  | 102 | 401 | Invalid or expired code |
  | 103 | 403 | `phone_required` |
  | 104 | 403 | Forbidden |
  | 105 | — | Foreign contact (bot only) |
  | 200 | 422 | Request validation |
  | 201 | 422 | Domain validation |
  | 202 | 429 | Rate limited |
  | 300 | 404 | Not found |
  | 400 | 409 | Conflict |
  | 500 | 500 | Internal |

- **Routes:** paths exactly as in spec Appendix A, trailing slashes included, and **no redirects**. Create the app with `FastAPI(redirect_slashes=False)`, and register `/api/activities/{pk}` **without** a trailing slash.

### Auth values
- **Tokens:** access token is a JWT, HS256, TTL 900 s, claims `sub`, `username`, `typ="access"`, `iat`, `exp`.
- **Refresh token:** opaque, made with `secrets.token_urlsafe(32)`, stored as `sha256` hex. TTL 30 days. Reuse grace is 30 s.
- **Refresh cookie:**
  - Name `eventopia_refresh`. Flags `HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age=2592000`, plus `Secure` when `auth.cookie_secure`.
  - `refresh` and `logout` require the header `X-Requested-With: eventopia`.
  - `telegram/webapp` never sets a cookie.
- **OTP:**
  - The code is 6 digits **as a string** (leading zeros allowed).
  - TTL 300 s, 5 attempts, resend after 60 s, at most 5 per phone per hour and 20 per IP per hour.
  - `code_hash = hmac_sha256(otp_pepper, f"{challenge_id}:{code}")`.
  - Sent with `protect_content=true`.
- **Mini App:** `initData` max age is 86400 s.

### Data
- **Neo4j:**
  - Queries must be Cypher 25: no `id()`, no APOC, `randomUUID()` for `pk`.
  - Relationship names exactly as in spec §6.6.
  - Points are `point({latitude:…, longitude:…})`.
- **Frontend:** nothing auth-related goes in `localStorage` or `sessionStorage`.

### Process
- **Commits:** commit after every task on branch `feat/fastapi-telegram`. Never push. Never commit `api/config*.yaml` other than `api/config.example.yaml`.
- **The old Django code** under `backend/` is read-only reference until Task 21 deletes it. The old code's response shapes are the reference for any field not listed here.

## Review Focus

1. **Phone numbers as people type them.**
   - Inputs: `+998 90 123-45-67`, `(90) 123 45 67`, `901234567`, and Telegram's `998901234567` without `+`.
   - All must normalize to `+998901234567`. Garbage returns 422 code 201.
   - Pinned in Task 4.
2. **OTP codes with leading zeros** (e.g. `"004219"`). The code must stay a string end to end and verify successfully. Pinned in Task 7.
3. **Unicode and space-containing team names in URLs** (`Beijing 炎龙`, `Shuòguǒ 硕果 FC`, `Añejo FC 7s`). Both `GET /api/teams/{name}/` and `join/` must resolve them. Pinned in Task 13.
4. **The same Telegram user sharing a contact twice, or sharing the same number again after `/phone`.** There must be exactly one account and one identity, and no duplicate USER node. Pinned in Task 5.
5. **Telegram network errors or timeouts during polling.** The poller logs, backs off (1 s doubling to a 30 s cap), keeps the saved offset, and keeps running. Pinned in Task 9.

---

## File Structure

```
compose.dev.yml                      # Task 2 (neo4j, silo, silo-init), Task 16 (api, bot, web)
api/
  pyproject.toml, uv.lock, Dockerfile, entrypoint.sh, alembic.ini
  config.example.yaml                # committed; config-local-dev.yaml git-ignored (moved from repo root)
  main.py                            # uvicorn target `main:app`
  bot_main.py                        # bot process
  migrations/env.py, migrations/versions/0001_auth_store.py
  eventopia/
    __init__.py        create_app
    config.py          TypedDict sections, load_config, ConfigError
    exceptions.py      ServiceException hierarchy
    wiring.py          Container, build_container
    phone.py           normalize_phone, mask_phone
    context/request_id.py, context/neo4j.py, context/sqlite.py
    models/auth.py     dataclass records + auth Pydantic I/O
    models/common.py   Envelope helpers (ok(), error())
    models/geo.py, models/activities.py, models/teams.py, models/organizations.py
    sqls/tables.py     SQLAlchemy table classes
    sqls/accounts.py, sqls/telegram.py, sqls/otp.py, sqls/sessions.py, sqls/bot_state.py
    cyphers/users.py, cyphers/geo.py, cyphers/categories.py, cyphers/locations.py,
    cyphers/activities.py, cyphers/teams.py, cyphers/organizations.py
    schema/constraints.cypher, schema/apply.py
    telegram/gateway.py (ABC + errors), telegram/http_gateway.py, telegram/fake.py,
    telegram/webapp.py (validate_init_data), telegram/texts.py
    services/account.py, services/session.py, services/otp.py, services/auth.py,
    services/media.py, services/geo.py, services/category.py, services/location.py,
    services/activity.py, services/team.py, services/organization.py
    storage/base.py (ObjectStorage ABC), storage/s3.py, storage/fake.py
    views/base.py (ApiView), views/deps.py, views/health.py, views/auth.py, views/users.py,
    views/geo.py, views/categories.py, views/locations.py, views/activities.py,
    views/teams.py, views/organizations.py
    bot/dispatcher.py, bot/poller.py
    seed/__main__.py, seed/loader.py, seed/data/*.json (moved from backend/core/data)
  tests/
    conftest.py, test_<area>.py per task
frontend/
  src/api/client.ts, src/api/tokenStore.ts, src/api/authApi.ts      # Task 17
  src/auth/AuthContext.tsx, src/auth/RequireAuth.tsx                  # Task 18
  vitest.config.ts, src/**/__tests__/*.test.ts
```

---

## Part A: Backend

### Task 1: Scaffold, config, envelope, errors, health

**Files:**
- Create: `api/pyproject.toml`, `api/config.example.yaml`, `api/main.py`, `api/eventopia/__init__.py`, `api/eventopia/config.py`, `api/eventopia/exceptions.py`, `api/eventopia/models/common.py`, `api/eventopia/context/request_id.py`, `api/eventopia/views/base.py`, `api/eventopia/views/health.py`, `api/eventopia/wiring.py`
- Move: repo-root `config-local-dev.yaml` → `api/config-local-dev.yaml` (keep mode 600). Fill in every key from §6.3. Dev values: `neo4j.uri: bolt://localhost:7687`, `s3.endpoint_url: http://localhost:9000`, `sqlite.path: ./.data/eventopia.sqlite3`, and random 32-byte secrets.
- Modify: `.gitignore` (add `api/config.yaml`, `api/.data/`)
- Test: `api/tests/conftest.py`, `api/tests/test_app_basics.py`, `api/tests/test_config.py`

**Interfaces:**
- **Produces:**
  - `load_config(path: str) -> AppConfig`. `AppConfig` is a TypedDict with keys `app`, `neo4j`, `sqlite`, `auth`, `telegram`, `s3`; section TypedDicts are named `AppSection`, `Neo4jSection`, etc.
  - `ConfigError(Exception)`
  - `ServiceException(code: int, message: str, http_status: int)` with subclasses `AuthError`(101/401), `InvalidCodeError`(102/401), `PhoneRequiredError`(103/403), `ForbiddenError`(104/403), `ForeignContactError`(105/400), `ValidationError`(201/422), `RateLimitedError`(202/429, attr `retry_after: int`), `NotFoundError`(300/404), `ConflictError`(400/409). Each subclass has a default message.
  - `ApiView` base with `router: APIRouter`.
  - `Container` dataclass with `views: list[ApiView]` and `async close()`.
  - `build_container(config: AppConfig, *, telegram: TelegramGateway | None = None, storage: ObjectStorage | None = None) -> Container`. In this task it holds only `HealthView`; later tasks add fields.
  - `create_app(container: Container) -> FastAPI`. It registers the request-ID middleware (reads or creates `X-Request-ID`, echoes it in the response header), the global exception handlers, and a lifespan that calls `container.close()`.
  - `current_request_id() -> str`
  - In `models/common.py`: `ok(data) -> dict` and `error(code, message, **extra) -> dict`

- [x] **Step 1: Write failing tests**

```python
# tests/test_config.py
def test_load_config_reports_missing_keys(tmp_path):
    p = tmp_path / "c.yaml"; p.write_text("app: {public_base_url: x}\n")
    with pytest.raises(ConfigError) as e:
        load_config(str(p))
    assert "neo4j.uri" in str(e.value) and "telegram.bot_token" in str(e.value)

def test_example_config_is_complete():
    cfg = load_config(str(API_DIR / "config.example.yaml"))
    assert cfg["auth"]["otp_ttl_seconds"] == 300 and cfg["auth"]["refresh_reuse_grace_seconds"] == 30

# tests/test_app_basics.py  (client fixture: httpx.AsyncClient(transport=ASGITransport(app)))
async def test_health_live_envelope(client):
    r = await client.get("/api/health/live")
    body = r.json()
    assert r.status_code == 200 and body["error"] == 0 and body["data"] == {"status": "ok"}
    assert body["requestId"] == r.headers["X-Request-ID"]

async def test_service_exception_shape(app_with_route_raising):  # route raises ConflictError("taken")
    r = await app_with_route_raising.get("/boom")
    assert r.status_code == 409 and r.json()["error"] == 400 and r.json()["message"] == "taken"

async def test_rate_limited_includes_retry_after(...):  # RateLimitedError(retry_after=42)
    assert r.status_code == 429 and r.json()["retry_after"] == 42

async def test_unknown_exception_is_generic_500(...):  # route raises RuntimeError("secret detail")
    assert r.status_code == 500 and r.json()["error"] == 500 and "secret detail" not in r.text

async def test_request_validation_is_422_code_200(...):  # POST body missing a required field
    assert r.status_code == 422 and r.json()["error"] == 200

async def test_trailing_slash_is_not_redirected(client):
    assert (await client.get("/api/health/live/")).status_code == 404
```

- [x] **Step 2: Run them and confirm they fail.** `cd api && uv run pytest tests/test_config.py tests/test_app_basics.py -v` → FAIL (import errors).
- [x] **Step 3: Implement the files listed under Interfaces.**
  - `pyproject.toml`: pytest settings `asyncio_mode = "auto"`, `asyncio_default_fixture_loop_scope = "session"`, `asyncio_default_test_loop_scope = "session"`, `markers = ["integration"]`. ruff on.
  - `main.py`: `app = create_app(build_container(load_config(os.environ.get("EVENTOPIA_CONFIG", "config-local-dev.yaml"))))`.
  - The 500 handler logs the traceback with the request ID.
  - `configure_logging(level: str)` lives in `context/request_id.py`. It installs a `logging.Filter` that sets `record.request_id = current_request_id()` (`"-"` outside a request). The format includes `%(request_id)s`. Add the test `test_log_records_carry_request_id` using `caplog`.
- [x] **Step 4: Run them and confirm they pass.** Same command → PASS. Also run `uv run ruff check .` → clean.
- [x] **Step 5: Commit.** `git add api .gitignore && git commit -m "feat(api): scaffold FastAPI service with YAML config, envelope and error handling"`. Check that `git status` does not list `api/config-local-dev.yaml`.

### Task 2: Neo4j connector, constraints, dev databases

**Files:**
- Create: `compose.dev.yml` (services `neo4j`, `silo`, `silo-init` per spec §6.2), `api/eventopia/context/neo4j.py`, `api/eventopia/schema/constraints.cypher`, `api/eventopia/schema/apply.py`
- Modify: `api/eventopia/views/health.py` (add `/api/health/ready`), `api/eventopia/wiring.py`
- Test: `api/tests/conftest.py` (Neo4j fixtures), `api/tests/test_neo4j.py`

**Interfaces:**
- **Consumes:** `Neo4jSection`, `Container`.
- **Produces:**
  - `Neo4jConnector(config: Neo4jSection)` with methods `read(work: Callable[[AsyncManagedTransaction], Awaitable[T]]) -> T`, `write(work) -> T` (via `session.execute_read` / `execute_write`), `ping() -> bool`, `close()`
  - `apply_constraints(connector: Neo4jConnector) -> None`, runnable as `python -m eventopia.schema.apply`
  - Fixture `neo4j_connector`: a session-scoped `testcontainers.neo4j.Neo4jContainer("neo4j:2026.10.1-community-trixie")`, constraints applied once, `MATCH (n) DETACH DELETE n` before each test
- **`constraints.cypher`:**
  - unique `USER.uid`, `USER.username`, `TEAM.name`
  - unique `pk` on `ACTIVITY`, `COMPETITION`, `ORGANIZATION`, `LOCATION`, `CATEGORY`
  - unique `name` on `CITY`, `STATE`, `COUNTRY`, `COLOR`, `LEAGUE`
  - `POINT INDEX` on `LOCATION.points`
  - All statements use `IF NOT EXISTS`.

- [x] **Step 1: Write failing tests**

```python
async def test_constraints_apply_twice(neo4j_connector):
    await apply_constraints(neo4j_connector)  # second run must not raise
    names = await neo4j_connector.read(lambda tx: _constraint_labels(tx))  # SHOW CONSTRAINTS
    assert {("USER", "uid"), ("USER", "username"), ("TEAM", "name"), ("ACTIVITY", "pk")} <= names

async def test_unique_user_uid_enforced(neo4j_connector):
    await neo4j_connector.write(lambda tx: tx.run("CREATE (:USER {uid:'u1', username:'a'})"))
    with pytest.raises(neo4j.exceptions.ConstraintError):
        await neo4j_connector.write(lambda tx: tx.run("CREATE (:USER {uid:'u1', username:'b'})"))

async def test_ready_reports_neo4j(client):
    r = await client.get("/api/health/ready")
    assert r.status_code == 200 and r.json()["data"]["neo4j"] is True
```

- [x] **Step 2: Run them and confirm they fail.** `uv run pytest tests/test_neo4j.py -v` → FAIL.
- [x] **Step 3: Implement.**
  - `/api/health/ready` returns 503 (code 500) if any dependency fails `ping()`. It reports `{"neo4j": bool}`, and later also `sqlite`.
  - In `compose.dev.yml`:
    - **neo4j:** `NEO4J_AUTH=neo4j/${NEO4J_PASSWORD:-devpassword123}`, `NEO4J_server_memory_heap_initial__size=512m`, `NEO4J_server_memory_heap_max__size=512m`, `NEO4J_server_memory_pagecache_size=384m`. Ports `127.0.0.1:7474` and `127.0.0.1:7687`. Healthcheck `wget -q --spider http://localhost:7474 || exit 1`.
    - **silo:** ports `127.0.0.1:9000` and `127.0.0.1:9001`, `GOMEMLIMIT=600MiB`.
    - **silo-init:** the `mcli` script from §6.2, run with `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD`, `APP_KEY` and `APP_SECRET` from `.env.dev` (git-ignored).
- [x] **Step 4: Run tests, then the stack.**
  - `uv run pytest tests/test_neo4j.py -v` → PASS.
  - Then `docker compose -f compose.dev.yml up -d neo4j silo silo-init && docker compose -f compose.dev.yml ps` → `neo4j` and `silo` healthy, `silo-init` exited 0.
- [x] **Step 5: Commit.** `git commit -m "feat(api): Neo4j connector, idempotent constraints, dev compose for neo4j and silo"`

### Task 3: SQLite auth store (migration and data access)

**Files:**
- Create: `api/alembic.ini`, `api/migrations/env.py`, `api/migrations/versions/0001_auth_store.py`, `api/eventopia/context/sqlite.py`, `api/eventopia/models/auth.py` (records only), `api/eventopia/sqls/tables.py`, `api/eventopia/sqls/{accounts,telegram,otp,sessions,bot_state}.py`
- Modify: `wiring.py`, `views/health.py` (`ready` adds `sqlite`)
- Test: `api/tests/test_sqls.py`, `conftest.py` (`sqlite_connector` fixture: temp file plus `alembic.command.upgrade(cfg, "head")`)

**Interfaces:**
- **Consumes:** `SqliteSection`.
- **Produces:**
  - **`SqliteConnector(config: SqliteSection)`** with methods `session() -> AsyncContextManager[AsyncSession]` (commits on success, rolls back on error), `ping() -> bool`, `close()`.
    - Engine `sqlite+aiosqlite:///<path>`.
    - On every connection: `PRAGMA journal_mode=WAL`, `busy_timeout=5000`, `foreign_keys=ON`.
  - **Records** (dataclasses in `models/auth.py`): `AccountRecord(uid, status, created_at)`, `TelegramIdentityRecord(account_uid, telegram_user_id, chat_id, phone_e164, phone_verified_at, username, first_name, last_name, language_code, chat_active, chat_status_changed_at, updated_at)`, `OtpChallengeRecord(id, phone_e164, account_uid, code_hash, created_at, expires_at, attempts, consumed_at, superseded_at, requester_ip, delivered)`, `RefreshSessionRecord(id, account_uid, family_id, token_hash, issued_at, expires_at, revoked_at, replaced_by, user_agent, ip)`.
  - **`sqls/accounts.py`:** `insert_account(s, uid, now)`, `select_account(s, uid) -> AccountRecord | None`
  - **`sqls/telegram.py`:** `select_identity_by_telegram_id(s, tg_id)`, `select_identity_by_phone(s, phone)`, `select_identity_by_account(s, uid)`, `insert_identity(s, rec)`, `update_identity_profile(s, tg_id, *, chat_id, username, first_name, last_name, language_code, now)`, `set_identity_phone(s, tg_id, phone_e164: str | None, verified_at: datetime | None, now)`, `set_chat_active(s, tg_id, active: bool, now)`
  - **`sqls/otp.py`:** `insert_challenge(s, rec)`, `select_open_challenge(s, phone, now) -> OtpChallengeRecord | None` (newest, not consumed or superseded, `expires_at > now`), `supersede_open_challenges(s, phone, now)`, `increment_attempts(s, id) -> int`, `mark_consumed(s, id, now)`, `count_for_phone_since(s, phone, since) -> int`, `count_for_ip_since(s, ip, since) -> int`, `latest_created_for_phone(s, phone) -> datetime | None`
  - **`sqls/sessions.py`:** `insert_session(s, rec)`, `select_session_by_hash(s, token_hash)`, `revoke_session(s, id, now, replaced_by: str | None = None)`, `revoke_family(s, family_id, now)`, `revoke_all_for_account(s, uid, now)`, `select_session(s, id)`
  - **`sqls/bot_state.py`:** `get_value(s, key) -> str | None`, `set_value(s, key, value)`

- [x] **Step 1: Write failing tests** (one per module):

```python
async def test_wal_and_foreign_keys(sqlite_connector):
    async with sqlite_connector.session() as s:
        assert (await s.execute(text("PRAGMA journal_mode"))).scalar() == "wal"
        assert (await s.execute(text("PRAGMA foreign_keys"))).scalar() == 1

async def test_phone_unique_across_identities(sqlite_connector):
    # two identities with the same phone_e164 → IntegrityError
async def test_open_challenge_ignores_expired_superseded_consumed(sqlite_connector):
    # insert 4 challenges for one phone (expired, superseded, consumed, open) → returns the open one
async def test_counts_since(sqlite_connector):
    # 3 challenges for phone A from ip X in last hour, 1 older → count_for_phone_since == 3, count_for_ip_since == 3
async def test_revoke_family_and_all(sqlite_connector):
    # 2 sessions same family + 1 other family same account → revoke_family revokes 2; revoke_all revokes the 3rd
async def test_bot_state_roundtrip(sqlite_connector):
    await set_value(s, "offset", "41"); assert await get_value(s, "offset") == "41"
```

- [x] **Step 2: Run them and confirm they fail.** `uv run pytest tests/test_sqls.py -v` → FAIL.
- [x] **Step 3: Implement** the migration, connector, tables and functions. The migration columns are exactly as in spec §6.5. Functions return the records, not ORM objects.
- [x] **Step 4: Run them and confirm they pass.** `uv run pytest tests/test_sqls.py -v` → PASS. Then `uv run alembic upgrade head` against a temp path → exit 0.
- [x] **Step 5: Commit.** `git commit -m "feat(api): SQLite auth store with Alembic migration and data-access functions"`

### Task 4: Phone utils, Telegram gateway, initData validation

**Files:**
- Create: `api/eventopia/phone.py`, `api/eventopia/telegram/{gateway,http_gateway,fake,webapp}.py`
- Test: `api/tests/test_phone.py`, `api/tests/test_telegram_gateway.py`, `api/tests/test_webapp.py`

**Interfaces:**
- **Produces:**
  - `normalize_phone(raw: str, default_region: str = "UZ") -> str`. Prefix `+` when the input is all digits and starts with a country code of 11+ digits, as Telegram sends them. Raises `ValidationError`.
  - `mask_phone(e164: str) -> str`
  - `class TelegramGateway(ABC)`:
    - `send_message(chat_id: int, text: str, *, reply_markup: dict | None = None, protect_content: bool = False) -> None`
    - `get_updates(offset: int | None, timeout: int, allowed_updates: Sequence[str]) -> list[dict]`
    - `close()`
  - Exceptions `TelegramForbiddenError` (HTTP 403 from Telegram) and `TelegramApiError`.
  - `HttpTelegramGateway(config: TelegramSection, client: httpx.AsyncClient | None = None)`. The httpx timeout must be at least `poll_timeout_seconds + 10`.
  - `FakeTelegramGateway`:
    - Attributes: `sent: list[SentMessage(chat_id, text, reply_markup, protect_content)]`, `forbidden_chat_ids: set[int]`, `updates: list[dict]`, `fail_next_get_updates: int`.
    - `get_updates` raises `TelegramApiError` while `fail_next_get_updates > 0`.
  - `WebAppUser(id: int, username: str | None, first_name: str, last_name: str | None, language_code: str | None)`
  - `validate_init_data(init_data: str, bot_token: str, max_age_seconds: int, now: int) -> WebAppUser`. Raises `AuthError`. Algorithm per §6.5: the data-check-string is the sorted `key=value` pairs, excluding `hash`, joined with `\n`; compare with `hmac.compare_digest`.

- [ ] **Step 1: Write failing tests**

```python
@pytest.mark.parametrize("raw", ["+998 90 123-45-67", "(90) 123 45 67", "901234567", "998901234567", "+998901234567"])
def test_normalize_uz(raw): assert normalize_phone(raw) == "+998901234567"
@pytest.mark.parametrize("raw", ["", "abc", "123", "+1 555"])
def test_normalize_rejects(raw):
    with pytest.raises(ValidationError): normalize_phone(raw)
def test_mask(): assert mask_phone("+998901234567") == "+998 90 *** 4567"

async def test_http_gateway_send_message_payload():  # httpx.MockTransport capturing request
    # POST https://api.telegram.org/bot<token>/sendMessage, json has chat_id, text, protect_content True, reply_markup
async def test_http_gateway_403_raises_forbidden():  # transport returns 403 {"ok":false,"error_code":403}
async def test_get_updates_params():  # offset=42, timeout=50, allowed_updates=["message","my_chat_member"]

def test_init_data_valid(): user = validate_init_data(sign({...,"user": json.dumps({"id": 7, "first_name": "Ali"})}), TOKEN, 86400, now); assert user.id == 7
def test_init_data_tampered():  # change user after signing → AuthError
def test_init_data_expired():   # auth_date = now - 86401 → AuthError
def test_init_data_missing_hash():  # → AuthError
```

`sign()` is a test helper that implements Telegram's algorithm independently, inside the test file.

- [ ] **Step 2: Run them and confirm they fail.** `uv run pytest tests/test_phone.py tests/test_telegram_gateway.py tests/test_webapp.py -v` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and confirm they pass.** Same command → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(api): phone normalization, Telegram gateway and Mini App initData validation"`

### Task 5: AccountService (registration from a contact, ensure_profile, usernames)

**Files:**
- Create: `api/eventopia/services/account.py`, `api/eventopia/cyphers/users.py`
- Modify: `models/auth.py` (adds `TelegramUser`, `SharedContact`, `RegistrationResult`, `UserProfile`), `wiring.py`
- Test: `api/tests/test_account_service.py`

**Interfaces:**
- **Consumes:** Task 3 `sqls/*`, `Neo4jConnector`, `normalize_phone`, `mask_phone`.
- **Produces:**
  - Data types:
    - `TelegramUser(id: int, username: str | None, first_name: str, last_name: str | None, language_code: str | None)`
    - `SharedContact(user_id: int | None, phone_number: str)`
    - `RegistrationResult(uid: str, username: str, phone_e164: str, is_new: bool)`
    - `UserProfile(uid, username, first_name, last_name, image_url: str | None, gender: str | None, birth_date: str | None)`
  - `AccountService(neo4j: Neo4jConnector, sqlite: SqliteConnector, auth_config: AuthSection)` with methods:
    - `register_from_contact(sender: TelegramUser, contact: SharedContact, chat_id: int) -> RegistrationResult`. Raises `ForeignContactError` when `contact.user_id != sender.id`.
    - `touch_identity(sender: TelegramUser, chat_id: int) -> TelegramIdentityRecord | None`. Updates the names and sets `chat_active=True` if the identity exists.
    - `set_chat_active(telegram_user_id: int, active: bool) -> None`
    - `get_identity_by_telegram_id(tg_id) -> TelegramIdentityRecord | None`
    - `get_active_identity_by_phone(phone_e164) -> TelegramIdentityRecord | None`. Requires `chat_active` and a verified phone.
    - `ensure_profile(uid: str) -> UserProfile`
    - `is_account_active(uid: str) -> bool`, with an in-process TTL cache of 60 s.
  - `cyphers/users.py`:
    - `merge_user(tx, uid, username, first_name, last_name, created_at_iso) -> UserProfile`. Uses `MERGE (u:USER {uid:$uid}) ON CREATE SET … , u.claimed = true`.
    - `select_user(tx, uid) -> UserProfile | None`
    - `username_taken(tx, username) -> bool`
  - Module function `username_candidates(telegram_username: str | None, first_name: str, rng: Random) -> Iterator[str]`. It yields the lowercased Telegram username first if it matches `^[a-z0-9_]{3,32}$`, then `slug(first_name)[:24] + 4 random digits`, forever.

- [ ] **Step 1: Write failing tests**

```python
async def test_new_contact_creates_account_identity_and_user(account_service, neo4j_connector):
    r = await account_service.register_from_contact(TG(7, "Roma_K", "Roma"), SharedContact(7, "998901234567"), chat_id=7)
    assert r.is_new and r.phone_e164 == "+998901234567" and r.username == "roma_k"
    assert (await neo4j_connector.read(lambda tx: select_user(tx, r.uid))).username == "roma_k"

async def test_foreign_contact_rejected(account_service):
    with pytest.raises(ForeignContactError):
        await account_service.register_from_contact(TG(7, None, "A"), SharedContact(8, "+998901234567"), 7)

async def test_sharing_twice_is_idempotent(account_service, neo4j_connector):   # Review Focus 4
    a = await account_service.register_from_contact(TG(7, None, "Ali"), SharedContact(7, "+998901234567"), 7)
    b = await account_service.register_from_contact(TG(7, None, "Ali"), SharedContact(7, "+998901234567"), 7)
    assert a.uid == b.uid and not b.is_new
    assert await _count(neo4j_connector, "MATCH (u:USER) RETURN count(u)") == 1

async def test_phone_takeover_moves_phone_and_revokes_sessions(account_service, sqlite_connector):
    a = await account_service.register_from_contact(TG(7, None, "A"), SharedContact(7, "+998901234567"), 7)
    # insert a refresh session for a.uid
    b = await account_service.register_from_contact(TG(9, None, "B"), SharedContact(9, "+998901234567"), 9)
    assert (await account_service.get_identity_by_telegram_id(7)).phone_e164 is None
    assert (await account_service.get_identity_by_telegram_id(9)).phone_e164 == "+998901234567"
    # a.uid session now has revoked_at set

async def test_username_falls_back_when_taken(account_service, neo4j_connector):
    # pre-create USER {username:"roma_k"} → new user with tg username Roma_K gets r"^roma\d{4}$"

async def test_ensure_profile_repairs_missing_user_node(account_service, neo4j_connector):
    r = await account_service.register_from_contact(...); await _delete_user(neo4j_connector, r.uid)
    p = await account_service.ensure_profile(r.uid); assert p.uid == r.uid
```

- [ ] **Step 2: Run them and confirm they fail.** `uv run pytest tests/test_account_service.py -v` → FAIL.
- [ ] **Step 3: Implement.**
  - Do the SQLite work in **one** `session()` block, then `ensure_profile`.
  - The takeover logs `mask_phone(...)` at WARNING.
- [ ] **Step 4: Run them and confirm they pass.** Same command → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(api): AccountService with contact registration, phone takeover and ensure_profile"`

### Task 6: SessionService (JWT and refresh rotation)

**Files:**
- Create: `api/eventopia/services/session.py`
- Modify: `models/auth.py` (`AccessClaims(uid, username)`, `RotateOutcome(uid: str, new_refresh_token: str | None)`), `wiring.py`
- Test: `api/tests/test_session_service.py`

**Interfaces:**
- **Consumes:** `sqls/sessions.py`.
- **Produces:** `SessionService(sqlite: SqliteConnector, auth_config: AuthSection, clock: Callable[[], datetime] = utcnow)` with methods:
  - `issue_access_token(uid: str, username: str) -> str`
  - `verify_access_token(token: str) -> AccessClaims`. Raises `AuthError` for expired, bad signature or wrong `typ`.
  - `create_refresh(uid: str, user_agent: str | None, ip: str | None) -> str`. Starts a new family.
  - `rotate_refresh(raw: str) -> RotateOutcome`
  - `revoke_refresh(raw: str | None) -> None`. Does nothing for an unknown or None token.

- [ ] **Step 1: Write failing tests** (use an injected `clock`)

```python
def test_access_token_roundtrip_and_expiry(session_service, clock):
    t = session_service.issue_access_token("u1", "ali"); assert session_service.verify_access_token(t).uid == "u1"
    clock.advance(seconds=901)
    with pytest.raises(AuthError): session_service.verify_access_token(t)

async def test_rotate_returns_new_token_and_revokes_old(session_service):
    raw = await session_service.create_refresh("u1", "ua", "1.2.3.4")
    out = await session_service.rotate_refresh(raw)
    assert out.uid == "u1" and out.new_refresh_token and out.new_refresh_token != raw

async def test_reuse_within_grace_is_tolerated(session_service, clock):
    raw = await session_service.create_refresh("u1", None, None); await session_service.rotate_refresh(raw)
    clock.advance(seconds=29)
    out = await session_service.rotate_refresh(raw)
    assert out.uid == "u1" and out.new_refresh_token is None

async def test_reuse_after_grace_revokes_family(session_service, clock):
    raw = await session_service.create_refresh("u1", None, None); new = (await session_service.rotate_refresh(raw)).new_refresh_token
    clock.advance(seconds=31)
    with pytest.raises(AuthError): await session_service.rotate_refresh(raw)
    with pytest.raises(AuthError): await session_service.rotate_refresh(new)   # family revoked

async def test_expired_refresh_rejected(session_service, clock):  # advance 30 days + 1 s → AuthError
async def test_revoke_then_rotate_fails(session_service):        # revoke_refresh(raw) → rotate raises AuthError
```

- [ ] **Step 2: Run them and confirm they fail.** `uv run pytest tests/test_session_service.py -v` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and confirm they pass.** Same command → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(api): SessionService with short JWTs and rotating refresh tokens with reuse detection"`

### Task 7: OtpService

**Files:**
- Create: `api/eventopia/services/otp.py`, `api/eventopia/telegram/texts.py`
- Modify: `wiring.py`
- Test: `api/tests/test_otp_service.py`

**Interfaces:**
- **Consumes:** `AccountService.get_active_identity_by_phone`, `AccountService.set_chat_active`, `TelegramGateway`, `sqls/otp.py`, `normalize_phone`.
- **Produces:**
  - `OtpService(sqlite, telegram: TelegramGateway, account_service: AccountService, auth_config: AuthSection, clock=utcnow, code_factory: Callable[[], str] = _random_6_digits)` with methods:
    - `request_code(phone_raw: str, ip: str | None) -> int`. Returns `retry_after_seconds` (60). Raises `ValidationError` or `RateLimitedError`.
    - `verify_code(phone_raw: str, code: str) -> str`. Returns the uid. Raises `InvalidCodeError`.
  - `texts.pick_language(language_code: str | None) -> Literal["uz", "ru", "en"]`
  - `texts.otp_message(lang, code: str, ttl_minutes: int) -> str`. Every language includes the code, "5", and a do-not-share warning.

- [ ] **Step 1: Write failing tests**

```python
async def test_registered_phone_gets_code_via_bot(otp, fake_telegram, registered):  # registered: tg 7, +998901234567, lang "ru"
    assert await otp.request_code("90 123 45 67", "1.1.1.1") == 60
    msg = fake_telegram.sent[-1]
    assert msg.chat_id == 7 and msg.protect_content and "123456" in msg.text  # code_factory returns "123456"

async def test_unknown_phone_same_response_no_message(otp, fake_telegram):
    assert await otp.request_code("+998935550000", "1.1.1.1") == 60 and fake_telegram.sent == []

async def test_inactive_chat_gets_no_message(otp, fake_telegram, registered):  # set_chat_active(7, False)

async def test_forbidden_marks_chat_inactive(otp, fake_telegram, account_service, registered):
    fake_telegram.forbidden_chat_ids.add(7)
    assert await otp.request_code("+998901234567", None) == 60
    assert (await account_service.get_identity_by_telegram_id(7)).chat_active is False

async def test_resend_cooldown(otp, registered, clock):   # second request at +30 s → RateLimitedError(retry_after=30)
async def test_hourly_phone_limit(otp, registered, clock): # 5 requests 61 s apart ok, 6th within the hour → RateLimitedError
async def test_ip_limit(otp, clock):                       # 20 different phones same IP ok, 21st → RateLimitedError

async def test_verify_success_consumes(otp, registered):
    await otp.request_code("+998901234567", None); uid = await otp.verify_code("+998901234567", "123456")
    assert uid == registered.uid
    with pytest.raises(InvalidCodeError): await otp.verify_code("+998901234567", "123456")

async def test_leading_zero_code(otp_with_code_004219, registered):  # Review Focus 2
    await otp_with_code_004219.request_code("+998901234567", None)
    assert await otp_with_code_004219.verify_code("+998901234567", "004219") == registered.uid

async def test_five_wrong_attempts_kill_challenge(otp, registered):  # 5× "000000" fail, then correct code also fails
async def test_expired_code_fails(otp, registered, clock):            # +301 s → InvalidCodeError
async def test_new_request_supersedes_old_code(otp, registered, clock): # old code fails after a second request at +61 s
async def test_unknown_phone_verify_same_error(otp):                  # InvalidCodeError, message identical to the wrong-code case
```

- [ ] **Step 2: Run them and confirm they fail.** `uv run pytest tests/test_otp_service.py -v` → FAIL.
- [ ] **Step 3: Implement.**
  - The rate-limit checks run **before** the identity lookup, so unknown and known phones are limited the same way.
  - Record a challenge row even for unknown phones, with `account_uid=None` and `delivered=False`, so the limits count them.
- [ ] **Step 4: Run them and confirm they pass.** Same command → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(api): OtpService delivering login codes through the bot with rate limits"`

### Task 8: Auth and users endpoints

**Files:**
- Create: `api/eventopia/services/auth.py`, `api/eventopia/views/deps.py`, `api/eventopia/views/auth.py`, `api/eventopia/views/users.py`
- Modify: `models/auth.py` (Pydantic: `OtpRequestIn(phone)`, `OtpVerifyIn(phone, code: str)`, `WebAppLoginIn(init_data)`, `UserOut(uid, username, first_name, last_name, image_url)`, `LoginOut(access_token, user: UserOut)`, `AccessOut(access_token)`, `RetryOut(retry_after_seconds)`, `MeOut(uid, username, first_name, last_name, image_url, gender, birth_date, phone_masked)`), `wiring.py`
- Test: `api/tests/test_auth_api.py`

**Interfaces:**
- **Consumes:** Tasks 4–7.
- **Produces:**
  - `AuthService(account_service, session_service, otp_service, telegram_config: TelegramSection, auth_config: AuthSection)` with methods:
    - `request_otp(phone, ip) -> RetryOut`
    - `login_with_otp(phone, code, user_agent, ip) -> tuple[LoginOut, str]`. The second element is the refresh token.
    - `login_with_webapp(init_data) -> LoginOut`. Raises `PhoneRequiredError`.
    - `refresh(raw: str | None) -> tuple[AccessOut, str | None]`
    - `logout(raw: str | None) -> None`
    - `authenticate(bearer: str | None) -> AccessClaims`. Verifies the token and checks `is_account_active`.
    - `me(uid) -> MeOut`
  - `views/deps.py`:
    - `build_current_user(auth_service) -> Callable` (FastAPI dependency returning `AccessClaims`)
    - `require_xrw(request)`, which raises `ForbiddenError` unless `X-Requested-With == "eventopia"`
    - `set_refresh_cookie(response, raw, auth_config)`, `clear_refresh_cookie(response, auth_config)`
  - `AuthView` and `UsersView` serve the Appendix A auth rows and `/api/users/me`.

- [ ] **Step 1: Write failing tests**

```python
async def test_otp_login_sets_strict_httponly_cookie(client, registered, fake_telegram):
    await client.post("/api/auth/otp/request", json={"phone": "+998901234567"})
    r = await client.post("/api/auth/otp/verify", json={"phone": "+998901234567", "code": last_code(fake_telegram)})
    data = r.json()["data"]; assert set(data) == {"access_token", "user"} and data["user"]["uid"] == registered.uid
    c = r.headers["set-cookie"]
    assert "eventopia_refresh=" in c and "HttpOnly" in c and "SameSite=Strict" in c and "Path=/api/auth" in c and "Max-Age=2592000" in c

async def test_secure_flag_when_configured(client_secure, ...):   # auth.cookie_secure=True → "Secure" in set-cookie
async def test_refresh_requires_xrw(client_logged_in):           # no header → 403 code 104
async def test_refresh_rotates_cookie(client_logged_in):         # with header → 200, new access_token, new cookie value
async def test_refresh_without_cookie_is_401(client):            # 401 code 101
async def test_logout_clears_cookie_and_revokes(client_logged_in):  # then refresh → 401
async def test_webapp_login_no_cookie(client, registered_tg7):
    r = await client.post("/api/auth/telegram/webapp", json={"init_data": signed_for(7)})
    assert r.status_code == 200 and "set-cookie" not in r.headers
async def test_webapp_phone_required(client):                    # tg user without identity → 403 code 103
async def test_webapp_tampered_401(client):
async def test_me_requires_bearer_and_masks_phone(client_logged_in):
    r = await client_logged_in.get("/api/users/me")
    assert r.json()["data"]["phone_masked"] == "+998 90 *** 4567"
async def test_disabled_account_rejected(client_logged_in, sqlite_connector):  # set status=disabled, expire cache → 401
async def test_otp_request_same_body_for_unknown_and_known(client, registered): # response bodies equal apart from requestId
```

- [ ] **Step 2: Run them and confirm they fail.** `uv run pytest tests/test_auth_api.py -v` → FAIL.
- [ ] **Step 3: Implement.**
  - The client IP comes from `request.client.host`. A trusted proxy header is handled in sub-project 2.
  - The user agent comes from the `User-Agent` header.
- [ ] **Step 4: Run them and confirm they pass.** Same command → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(api): auth endpoints (OTP, Mini App initData, refresh cookie, logout, me)"`

### Task 9: Bot process (dispatcher and poller)

**Files:**
- Create: `api/eventopia/bot/dispatcher.py`, `api/eventopia/bot/poller.py`, `api/bot_main.py`
- Modify: `telegram/texts.py` (bot texts in uz/ru/en: welcome, share-button label, foreign-contact refusal, registered confirmation with `{public_base_url}/login`, already-registered with masked phone, help, phone-change prompt), `telegram/gateway.py` + `http_gateway.py` + `fake.py` (add `delete_webhook() -> None`; the fake records `webhook_deleted = True`), `wiring.py` (`build_bot_container(config)`)
- Test: `api/tests/test_bot.py`

**Interfaces:**
- **Consumes:** `AccountService`, `TelegramGateway`, `sqls/bot_state.py`, `texts`.
- **Produces:**
  - `BotDispatcher(account_service, telegram: TelegramGateway, app_config: AppSection)` with `handle_update(update: dict) -> None`. Only private chats are handled.
  - `BotPoller(dispatcher, telegram, sqlite, telegram_config, sleep: Callable[[float], Awaitable] = asyncio.sleep)` with methods:
    - `run_once() -> int` (updates handled)
    - `run_forever() -> None`
  - The offset key is `"getUpdates.offset"`.
  - Reply keyboards:
    - Share button: `{"keyboard": [[{"text": <label>, "request_contact": True}]], "one_time_keyboard": True, "resize_keyboard": True}`
    - Remove keyboard: `{"remove_keyboard": True}`

- [ ] **Step 1: Write failing tests** (updates are plain dicts shaped like the Telegram Bot API)

```python
async def test_start_unregistered_shows_share_button(dispatcher, fake_telegram):
    await dispatcher.handle_update(msg_update(7, text="/start", lang="uz"))
    kb = fake_telegram.sent[-1].reply_markup
    assert kb["keyboard"][0][0]["request_contact"] is True

async def test_own_contact_registers_and_removes_keyboard(dispatcher, fake_telegram, account_service):
    await dispatcher.handle_update(contact_update(7, contact_user_id=7, phone="998901234567"))
    assert fake_telegram.sent[-1].reply_markup == {"remove_keyboard": True}
    assert "/login" in fake_telegram.sent[-1].text
    assert (await account_service.get_identity_by_telegram_id(7)).phone_e164 == "+998901234567"

async def test_foreign_contact_refused(dispatcher, fake_telegram, account_service):   # contact_user_id=8 → no identity
async def test_start_registered_shows_masked_phone(dispatcher, fake_telegram, registered_tg7)  # "+998 90 *** 4567" in text
async def test_kicked_marks_inactive_member_reactivates(dispatcher, account_service, registered_tg7)
async def test_group_messages_ignored(dispatcher, fake_telegram):    # chat.type="group" → nothing sent
async def test_phone_command_shows_share_button(dispatcher, fake_telegram, registered_tg7)  # "/phone" → request_contact keyboard
async def test_update_refreshes_identity_names(dispatcher, account_service, registered_tg7)  # message from tg 7 with username "new_name" → identity.username == "new_name"
async def test_russian_texts(dispatcher, fake_telegram):             # lang "ru" → reply text in Cyrillic (contains a char in U+0400–U+04FF)

async def test_poller_persists_offset(poller, fake_telegram, sqlite_connector):
    fake_telegram.updates = [upd(41), upd(42)]
    assert await poller.run_once() == 2 and await _offset(sqlite_connector) == "43"

async def test_poller_survives_network_errors(poller, fake_telegram, sleeps):      # Review Focus 5
    fake_telegram.fail_next_get_updates = 3; fake_telegram.updates = [upd(50)]
    await poller.run_until_handled(1)   # test helper loops run_once catching nothing
    assert sleeps == [1, 2, 4] and await _offset(...) == "51"

async def test_handler_exception_does_not_stop_batch(poller, ...):  # a bad update is logged, the next one still handled, offset advances past both
```

- [ ] **Step 2: Run them and confirm they fail.** `uv run pytest tests/test_bot.py -v` → FAIL.
- [ ] **Step 3: Implement.**
  - `allowed_updates=["message", "my_chat_member"]`, `timeout=poll_timeout_seconds`.
  - Backoff is 1, 2, 4, … capped at 30 s, and resets after a success.
  - **Main loop of `bot_main.py`:** `load_config` → `build_bot_container` → `BotPoller.run_forever()`, with graceful shutdown on SIGTERM.
  - **On startup** it calls `deleteWebhook` if one is set. Add `delete_webhook()` to the gateway ABC; the fake records the call.
- [ ] **Step 4: Run tests, then a live check.**
  - `uv run pytest tests/test_bot.py -v` → PASS.
  - Manual check: `uv run python bot_main.py` with the real token, then send `/start` to @eventopiarobot from a phone. The share button appears, and sharing the contact gives the confirmation.
- [ ] **Step 5: Commit.** `git commit -m "feat(api): Telegram bot poller with contact-based sign-up"`

### Task 10: Media storage

**Files:**
- Create: `api/eventopia/storage/{base,s3,fake}.py`, `api/eventopia/services/media.py`
- Modify: `wiring.py`
- Test: `api/tests/test_media.py`

**Interfaces:**
- **Produces:**
  - `ObjectStorage(ABC)` with methods `put(key: str, data: bytes, content_type: str) -> None` and `delete(key: str) -> None`
  - `S3ObjectStorage(s3_config: S3Section)`:
    - boto3 client with `Config(signature_version="s3v4", s3={"addressing_style": "path"}, request_checksum_calculation="when_required", response_checksum_validation="when_required")`
    - Calls run through `anyio.to_thread.run_sync`.
  - `FakeObjectStorage` with `objects: dict[str, tuple[bytes, str]]`
  - `detect_image_type(data: bytes) -> tuple[str, str] | None`, returning `("image/jpeg", "jpg")`, `("image/png", "png")` or `("image/webp", "webp")`
  - `MediaService(storage: ObjectStorage, app_config: AppSection, s3_config: S3Section)` with methods:
    - `upload_image(kind: Literal["teams", "organizations"], data: bytes) -> str`. Returns `f"{public_base_url}/media/{public_prefix}/{kind}/{uuid4}.{ext}"`.
    - `delete_by_url(url: str | None) -> None`. Best effort: it logs and never raises.

- [ ] **Step 1: Write failing tests**

```python
@pytest.mark.parametrize("fixture,ctype", [("tiny.jpg","image/jpeg"),("tiny.png","image/png"),("tiny.webp","image/webp")])
async def test_upload_detects_type_and_builds_url(media, fake_storage, fixture, ctype):
    url = await media.upload_image("teams", read_fixture(fixture))
    assert re.fullmatch(r"http://localhost:5173/media/public/teams/[0-9a-f-]{36}\.(jpg|png|webp)", url)
    assert next(iter(fake_storage.objects.values()))[1] == ctype
async def test_rejects_gif_and_text(media):          # ValidationError code 201
async def test_rejects_over_5mb(media):              # 5_242_881 bytes of valid PNG header + padding → ValidationError
async def test_rejects_empty(media):                 # b"" → ValidationError
async def test_delete_by_url_never_raises(media, failing_storage)
@pytest.mark.integration
async def test_s3_roundtrip_against_silo(silo_container):  # put, then anonymous GET of the public object returns the bytes, then delete
```

Add tiny image fixtures under `tests/fixtures/`.

- [ ] **Step 2: Run them and confirm they fail.** `uv run pytest tests/test_media.py -v` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and confirm they pass.** `uv run pytest tests/test_media.py -v -m "integration or not integration"` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(api): S3 media storage for Silo with image type detection"`

### Task 11: Countries, categories, locations

**Files:**
- Create: `api/eventopia/cyphers/{geo,categories,locations}.py`, `api/eventopia/services/{geo,category,location}.py`, `api/eventopia/views/{geo,categories,locations}.py`, `api/eventopia/models/geo.py`
- Modify: `wiring.py`
- Test: `api/tests/test_geo_api.py`

**Contracts:**
- **`GET /api/countries/list/`:**
  - Returns `[{name, states: [{name, cities: [{name}]}]}]`. This is the old `backend/countries/models.py` query. Skip null states and cities instead of emitting `{name: null}`.
- **`GET /api/categories/?is_indoor=&is_outdoor=&is_online=`:**
  - Returns `[{pk, name, is_indoor, is_outdoor, is_online}]`.
  - Each query param is a `true`/`false` string; when present it filters that flag.
- **`POST /api/categories/`** (user):
  - Body `{name, is_indoor, is_outdoor, is_online}`. Returns 201 with the category.
  - A duplicate name (case-insensitive) returns 409.
- **`POST /api/locations/`** (user):
  - Accepts the body `frontend/src/components/Map/MapFunctions/AddLocation.ts` sends: `name`, `latitude`/`longitude` (or `points`), and `country`/`state`/`city` names.
  - `MERGE`s the `COUNTRY` → `STATE` → `CITY` `IS_IN` chain, then creates `LOCATION {pk: randomUUID(), name, points: point(...)}` with `-[:IS_IN]->(CITY)`.
  - Returns 201 `{pk, name, points: {latitude, longitude}}`.

- [ ] **Step 1: Write failing contract tests** covering every contract above, plus 401 without a token on both POSTs.
- [ ] **Step 2: Run them and confirm they fail.** `uv run pytest tests/test_geo_api.py -v` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and confirm they pass.** Same command → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(api): countries, categories and locations endpoints"`

### Task 12: Activities

**Files:**
- Create: `api/eventopia/cyphers/activities.py`, `api/eventopia/services/activity.py`, `api/eventopia/views/activities.py`, `api/eventopia/models/activities.py`
- Modify: `wiring.py`
- Test: `api/tests/test_activities_api.py`

**Contracts:**
- **Payload:** each activity is exactly the keys of `ActivityCardProps` in `frontend/src/types/ActivitiesListSchema.ts`: `categories[{name,pk}]`, `city{name}`, `competition{team_1{name,image_url},team_2{name,image_url}}`, `country{name}`, `creator{first_name,image_url,last_name,username}`, `date_time` (ISO-8601 string), `description`, `duration_in_minutes`, `location{name,pk,points{latitude,longitude}}`, `number_of_people_joined`, `people_joined[{first_name,image_url,last_name,username}]`, `pk`, `public`, `state{name}`, `title`.
  - For a non-competition activity, `competition` has all four values `null`.
- **Search** (`GET /api/activities/{country|state|city}/{csv}/`):
  - `csv` is comma-separated names.
  - Query params `search_by` (an optional title substring, case-insensitive), `countries[]` and `states[]` narrow the state and city searches. Semantics are as in the old `backend/activities/cypher_queries.py`.
- **Create** (`POST /api/activities/`, user):
  - The body is what `frontend/src/components/ActivitiesPage/NewActivityDrawer.tsx` sends, including `is_competition` and `competition: {team_1, team_2}` (team names), `categories`, the location pk, and geo names.
  - Writes `(USER)-[:CREATES]->(a)`, `HAPPENS_AT`, `IS_TYPE_OF`, `CITY_BASED_IN`/`STATE_BASED_IN`/`COUNTRY_BASED_IN`, and `IS_COMPETITION` → `COMPETITION -[:TEAM_1|TEAM_2]->` when it's a competition.
  - Returns 201 with the full payload.
  - `date_time` accepts ISO-8601 with or without milliseconds and with `Z` or an offset.
- **Detail** (`GET /api/activities/{pk}`): no trailing slash; 404 code 300 when unknown.
- **Join and leave** (`POST /api/activities/{pk}/join/`, `/leave/`): user only, idempotent. They return the updated payload.

- [ ] **Step 1: Write failing contract tests**, including these regressions from the audit:

```python
async def test_people_joined_lists_joiners_not_creator(...)        # creator A, joiners B,C → usernames {B,C}
async def test_count_not_inflated_by_categories(...)               # 3 categories, 2 joiners → number_of_people_joined == 2
async def test_non_competition_has_null_competition_names(...)
async def test_competition_roundtrip(...)                          # create with team_1/team_2 → names returned
async def test_date_time_without_millis_accepted(...)              # "2026-11-20T18:00:00Z"
async def test_search_city_with_countries_filter(...)
async def test_join_leave_idempotent_and_requires_auth(...)
```

- [ ] **Step 2: Run them and confirm they fail.** `uv run pytest tests/test_activities_api.py -v` → FAIL.
- [ ] **Step 3: Implement.** Port the Cypher from `backend/activities/cypher_queries.py`, using `collect(DISTINCT …)` and §6.6 relationship names.
- [ ] **Step 4: Run them and confirm they pass.** Same command → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(api): activities search, create, detail, join and leave"`

### Task 13: Teams

**Files:**
- Create: `api/eventopia/cyphers/teams.py`, `api/eventopia/services/team.py`, `api/eventopia/views/teams.py`, `api/eventopia/models/teams.py`
- Modify: `wiring.py`
- Test: `api/tests/test_teams_api.py`

**Contracts:**
- **Team payload:** the keys of `TeamSchema` in `frontend/src/types/TeamsListingSchema.ts`: `away_tshirt_color[{name}]`, `categories[{is_indoor,is_online,is_outdoor,name,pk}]`, `city_name`, `country_name`, `founded_at` (ISO date), `image_url` (an absolute URL or `null`), `location[{name,pk,points}]`, `men_team`, `name`, `public_team`, `shorts_color[{name}]`, `socks_color[{name}]`, `state_name`, `tshirt_color[{name}]`.
- **Detail payload:** adds `members[{username, first_name, last_name, image_url|null, name_on_jersey, role, plays_for_division|null, player_number}]`, `sponsors[{name}]` and `belongs_to_organization[{name}]`.
  - `role` is `IS_MEMBER_OF.position`.
  - No gender, phone or uid.
- **Endpoints:**
  - search `GET /api/teams/search/{q}/` (case-insensitive substring)
  - geo searches as in activities
  - `GET /api/teams/{name}/`
  - `POST /api/teams/` (user): multipart. The fields are what `NewTeamDrawer.tsx` sends, plus an optional `image`.
    - It writes `(USER)-[:CREATES]->(t)`, colors, category, location and geo.
    - It writes `(ORGANIZATION)-[:HAS_TEAM]->(t)` when an organization is given.
    - A missing `founded_at` or color must not break the write.
    - A duplicate name returns 409.
  - `POST /api/teams/{name}/join/` (user): body `{name_on_jersey, player_number, position}`.
    - `position` is one of the four.
    - 409 if already a member, or if the number is taken in that team.

- [ ] **Step 1: Write failing contract tests**, including:

```python
@pytest.mark.parametrize("name", ["Beijing 炎龙", "Shuòguǒ 硕果 FC", "Añejo FC 7s"])   # Review Focus 3
async def test_unicode_team_names_resolve(client_logged_in, seeded_team, name):
    assert (await client_logged_in.get(f"/api/teams/{quote(name)}/")).status_code == 200
    r = await client_logged_in.post(f"/api/teams/{quote(name)}/join/", json={"name_on_jersey": "ALI", "player_number": 77, "position": "Forward"})
    assert r.status_code == 200
async def test_join_conflicts(...)                   # same user twice → 409; another user same number → 409
async def test_member_payload_has_no_pii(...)        # keys == the set above
async def test_create_with_image_returns_absolute_url(...)   # fake storage; image_url startswith "http://localhost:5173/media/public/teams/"
async def test_create_without_image_or_founded_at(...)       # 201, image_url null
async def test_create_requires_auth(...)
async def test_search_arrays_have_no_duplicates(...)   # team with 2 categories, 4 colors, 3 members → each array has unique entries; search returns the team once
```

- [ ] **Step 2: Run them and confirm they fail.** `uv run pytest tests/test_teams_api.py -v` → FAIL.
- [ ] **Step 3: Implement.** Port the Cypher from `backend/teams/cypher_queries.py` and `services.py` with `DISTINCT`. `MediaService.upload_image("teams", …)` is called before the Neo4j write. If the write fails, call `delete_by_url`.
- [ ] **Step 4: Run them and confirm they pass.** Same command → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(api): teams search, create with image, detail with members, join with position"`

### Task 14: Organizations

**Files:**
- Create: `api/eventopia/cyphers/organizations.py`, `api/eventopia/services/organization.py`, `api/eventopia/views/organizations.py`, `api/eventopia/models/organizations.py`
- Modify: `wiring.py`
- Test: `api/tests/test_organizations_api.py`

**Contracts:**
- **Search payload:** the keys of `OrganizationListingSchema` in `frontend/src/types/OrganizationsListingSchema.ts`: `pk`, `name`, `created_at` (ISO date), `location{name,pk,points}`, `country{name}`, `state{name}`, `city{name}`, `image_url|null`, `teams_count`, `number_of_people_joined`, `number_of_teams_sponsored`, `hosting_leagues_count`, `hosting_activities_count`.
- **Geo searches actually apply the filter.**
- **`GET /api/organizations/list/`:** returns `[{pk, name}]`.
- **`POST /api/organizations/`** (user): multipart. The fields are what `NewOrganizationDrawer.tsx` sends, plus an optional `image`. It writes `(USER)-[:CREATES]->(o)`, `LOCATED_AT`, geo. A duplicate name returns 409.

- [ ] **Step 1: Write failing contract tests**, including `test_state_search_filters` (orgs in two states → only the requested state's are returned) and the counts.
- [ ] **Step 2: Run them and confirm they fail.** `uv run pytest tests/test_organizations_api.py -v` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and confirm they pass.** Same command → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(api): organizations search, list and create"`

### Task 15: Seed data

**Files:**
- Create: `api/eventopia/seed/__main__.py`, `api/eventopia/seed/loader.py`
- Move: `backend/core/data/*` → `api/eventopia/seed/data/` (`git mv`)
- Test: `api/tests/test_seed.py`

**Interfaces:**
- **Produces:** `seed_all(connector: Neo4jConnector, data_dir: Path, rng: Random) -> SeedSummary(teams: int, players: int, memberships: int, leagues: int, pitches: int)`, runnable as `python -m eventopia.seed`.
- **Rules** (spec §6.9):
  - Squads from `*_7s.json` are named `f"{name} 7s"`.
  - `female_division_1.json` → `men_team=false`.
  - The division number comes from the file name; 7s files keep their base division.
  - **A player is identified** by `uuid5(NAMESPACE, f"{name}|{birthday}")`. That gives the USER's `uid`, and the same person in several squads gets one USER with several memberships.
  - **Stored player fields:** username = `slug(name)` plus a numeric suffix on collision; `first_name`, `last_name`, `claimed=false`; nationality → `IS_FROM COUNTRY`.
  - **Never stored:** birthday, email or password.
  - **Memberships:** `IS_MEMBER_OF {player_number, name_on_jersey: name, position, plays_for_division, joined_at}`.
  - **Leagues** ("24-25 Division 1/2/3") and their participating teams come from `backend/core/functionss.py`.
  - **Pitches:** the 4 from the same file.
  - **The China → Beijing chain** (COUNTRY China ← STATE Beijing ← CITY Beijing).
  - Every write is a `MERGE`, so a second run changes nothing.

- [ ] **Step 1: Write failing tests**

```python
async def test_seed_counts_and_idempotency(neo4j_connector):
    s1 = await seed_all(neo4j_connector, DATA, Random(1)); s2 = await seed_all(neo4j_connector, DATA, Random(1))
    assert s1.teams == 48 and s2 == s1 and await _count(neo4j_connector, "MATCH (t:TEAM) RETURN count(t)") == 48
async def test_7s_renamed_and_have_players(neo4j_connector):   # "Afrika Utd 7s" exists and has > 0 members
async def test_female_teams_flagged(neo4j_connector)
async def test_no_personal_fields(neo4j_connector):           # no USER has birth_date/email/password props
async def test_usernames_unique_and_same_person_merged(neo4j_connector)
async def test_positions_on_membership(neo4j_connector):     # every IS_MEMBER_OF.position in the 4 values
```

- [ ] **Step 2: Run them and confirm they fail.** `uv run pytest tests/test_seed.py -v` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and confirm they pass.** Same command → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(api): idempotent seed of Beijing league data without personal fields"`

### Task 16: Full dev stack

**Files:**
- Create: `api/Dockerfile` (base `python:3.13-slim-trixie`, uv, non-root user), `api/entrypoint.sh` (`alembic upgrade head && python -m eventopia.schema.apply && exec "$@"`), `.env.dev.example`
- Modify: `compose.dev.yml`:
  - **`api`:** `EVENTOPIA_CONFIG=config-dev.yaml`, mounts `./api`, volume `auth-data:/data/auth`, command `uvicorn main:app --host 0.0.0.0 --port 8000 --reload`, healthcheck on `/api/health/ready`.
  - **`bot`:** command `python bot_main.py`, depends on `api` healthy, same volume.
  - **`web`:** `node:22-alpine`, `yarn install --frozen-lockfile && yarn dev --host`, port 5173, env `VITE_PROXY_API=http://api:8000`, `VITE_PROXY_MEDIA=http://silo:9000`.
- Also: `api/config-dev.yaml` (git-ignored; container hostnames), `README.md` "Run locally" section (replace the Docker section)

- [ ] **Step 1: Bring the stack up.** Run `docker compose -f compose.dev.yml up -d --build`, then `docker compose -f compose.dev.yml exec api python -m eventopia.seed`.
  - Expected: all services healthy, and the seed prints `teams=48`.
- [ ] **Step 2: Smoke check.** `curl -s localhost:5173/api/health/ready` → `{"requestId":…,"error":0,"data":{"neo4j":true,"sqlite":true}}`. `curl -s "localhost:5173/api/teams/search/Rockets/"` lists "Beijing Rockets" and "Beijing Rockets 7s".
- [ ] **Step 3: Commit.** `git commit -m "chore: full dev stack in compose (api, bot, web, neo4j, silo)"`

---

## Part B: Frontend

Run all commands in `frontend/`. Keep React 18, Vite 5 and Tailwind 3. Add devDependencies `vitest@3.2.7` and `qrcode.react@4.2.0`. Add the script `"test": "vitest run"`.

### Task 17: API client, in-memory token, refresh

**Files:**
- Create: `src/api/tokenStore.ts`, `src/api/client.ts`, `src/api/authApi.ts`, `vitest.config.ts`, `src/api/__tests__/client.test.ts`
- Modify:
  - `src/axios.tsx`: re-export `client` as the default, so existing imports keep working.
  - `vite.config.ts`: `server.proxy` with `/api` → `process.env.VITE_PROXY_API ?? "http://localhost:8000"` and `/media` → `process.env.VITE_PROXY_MEDIA ?? "http://localhost:9000"`; drop `define: {'process.env': {}}`; `build.sourcemap: false`.
  - Every call site: normalize paths to start with `/api/`. The full list comes from `grep -rn "api/" src`.

**Interfaces:**
- **Produces:**
  - `tokenStore`: `getAccessToken(): string | null`, `setAccessToken(t: string | null): void`, `onChange(cb): () => void`
  - `client`: an axios instance with:
    - `baseURL: import.meta.env.VITE_API_BASE_URL ?? "/"`, `withCredentials: true`
    - a request interceptor that adds the Bearer token
    - a response interceptor that unwraps `data`: `response.data = response.data.data` when `error === 0`
    - on a 401 (except on `/api/auth/*`), a single-flight `refreshAccessToken()` and a retry of the request, once
  - `authApi`:
    - `requestOtp(phone): Promise<{retry_after_seconds: number}>`
    - `verifyOtp(phone, code): Promise<{access_token, user}>`
    - `refreshAccessToken(): Promise<string | null>`, which POSTs `/api/auth/refresh` with `X-Requested-With: eventopia`. On a Mini App, it calls `loginWithWebApp(initData)` instead.
    - `loginWithWebApp(initData)`
    - `logout()`
    - `isInTelegram(): boolean`, true when `window.Telegram?.WebApp?.initData` is non-empty

- [ ] **Step 1: Write failing vitest tests.** Use a custom axios `adapter` as the fake transport.
  - Three parallel requests get 401 → exactly **one** refresh call → all three retried with the new token.
  - The refresh fails → the token is cleared, and the original error is rejected.
  - An envelope `{error:0,data:{x:1}}` → `response.data` equals `{x:1}`.
  - Every refresh request carries `X-Requested-With: eventopia`.
  - Nothing is written to `localStorage` (spy on `Storage.prototype.setItem`).
- [ ] **Step 2: Run them and confirm they fail.** `yarn test` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them and confirm they pass.** `yarn test` → PASS.
- [ ] **Step 5: Commit.** `git commit -m "feat(web): API client with envelope unwrap, in-memory token and single-flight refresh"`

### Task 18: Login, Telegram sign-up screen, auth context, route guard

**Files:**
- Create: `src/auth/AuthContext.tsx` (replaces the old auth context; state `{user, status: "loading"|"authenticated"|"anonymous"}`; on mount calls `refreshAccessToken()`, then `GET /api/users/me`), `src/auth/RequireAuth.tsx`, `src/auth/__tests__/phone.test.ts`
- Modify:
  - **`LoginForm.tsx`:**
    - Step 1: phone input prefilled with `+998`.
    - Step 2: a 6-digit code input with `inputMode="numeric"` and `autoComplete="one-time-code"`, plus a Resend button that counts down from `retry_after_seconds`.
    - The hint text from spec §6.5 and a link to `https://t.me/eventopiarobot`.
  - **`Register.tsx`:** becomes a "Sign up in Telegram" screen with the link and a `QRCodeSVG` of the link. Delete `user-register-form.tsx`.
  - **`UserNav.tsx`:** logout via `authApi.logout()`, and no `localStorage.clear()`.
  - **`App.tsx`:** wrap create and join actions and the routes that need a user in `RequireAuth`. Remove the leftover `localStorage` reads of profile and tokens everywhere (`grep -rn localStorage src`); only the theme key stays.

- [ ] **Step 1: Write a failing vitest test** for the display-formatting helper `formatUzPhone("+998901234567") === "+998 90 123 45 67"`.
- [ ] **Step 2: Run it and confirm it fails.** `yarn test` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests and check by hand.**
  - `yarn test` → PASS.
  - With the Task 16 stack and the real bot: log in with your phone, receive the code in Telegram, enter it, and land logged in.
  - Reload the page: you stay logged in (refresh cookie).
  - Log out: a reload shows you as anonymous.
  - DevTools → Application → Local Storage contains no tokens.
- [ ] **Step 5: Commit.** `git commit -m "feat(web): Telegram OTP login, Telegram sign-up screen, cookie-based session restore"`

### Task 19: Make the build pass

**Files:**
- Modify: `package.json` (`@types/react` and `@types/react-dom` pinned to the latest 18.x), plus every file importing `next/*`:
  - `next/link` → react-router `Link`: `LoginForm.tsx`, `MobileNavbar.tsx`, `LeftHeader.tsx`, `Register.tsx`
  - `next/image` → `<img>`: `MobileNavbar.tsx`, `Register.tsx`
  - `next/dynamic` → `React.lazy` + `Suspense`: `Globe.tsx`
  - Remove the Next `metadata` export in `Register.tsx`
  - Remove the `next`, `next-themes` and `geist` dependencies
  - Hide the chatbot entry point
  - Leave `src/components/Chat/` unreachable and untouched
- `BaseMap.tsx`: use `import.meta.env.VITE_MAPTILER_KEY`. Add `frontend/.env.example` with `VITE_MAPTILER_KEY=` and `VITE_API_BASE_URL=/`.
- `ActivitiesDetail.tsx:13`: fix the unused-variable error.

- [ ] **Step 1: Confirm the build fails today.** `yarn build` → FAIL (TS errors).
- [ ] **Step 2: Make the changes.**
- [ ] **Step 3: Confirm it passes.** `yarn build` → exit 0 with 0 TypeScript errors. `ls dist/assets/*.map` → no files.
- [ ] **Step 4: Commit.** `git commit -m "fix(web): build passes (React 18 types, no Next.js imports, env MapTiler key, no public sourcemaps)"`

### Task 20: Core flows

**Files:**
- Modify:
  - `src/types/TeamDetailsSchema.ts`: members drop `gender`; `image_url` and `plays_for_division` become `.nullable().optional()`.
  - `src/types/TeamsListingSchema.ts`: `image_url: z.string().url().nullable()`.
  - `NewTeamDrawer.tsx`: fix the crash at line 232 (`form.getValues('image')?.length ?? 0`); make the image optional.
  - `NewTeamDrawer.tsx:306` and `NewOrganizationDrawer.tsx:179`: `accept="image/jpeg,image/png,image/webp"`.
  - `JoinTeamButton.tsx`: replace the demo dialog with a form for jersey name, number (1–99) and position (Goalkeeper / Defender / Midfielder / Forward) that POSTs `/api/teams/{name}/join/`, shows a toast, and refreshes the team.
  - `UserNav.tsx:65`: remove the `'link'` fallback in favour of initials.
- Test: `src/types/__tests__/teamSchema.test.ts`

- [ ] **Step 1: Write a failing vitest test.** `TeamDetailSchema.parse(fixture)` must succeed for a team that has `image_url: null` and a member with `image_url: null`, `plays_for_division: null` and no `gender`.
- [ ] **Step 2: Run it and confirm it fails.** `yarn test` → FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run tests and walk through the flows by hand.**
  - `yarn test` and `yarn build` → PASS.
  - On the dev stack, logged in:
    - create an organization with an image (the image shows)
    - create a team with an image under it
    - open the team page
    - join the team with a position (you appear in members)
    - create an activity with a location
    - create a competition activity between two teams
    - join and then leave an activity
    - search activities, teams and organizations by country, state and city on `/activities` and `/map`
- [ ] **Step 5: Commit.** `git commit -m "fix(web): team page schema, team drawer crash, join team with position, image inputs"`

### Task 21: Remove Django and verify the whole thing

**Files:**
- Delete (`git rm -r`):
  - **Django and its deployment files:** `backend/`, root `requirements.txt`, `Procfile`, `docker-compose.yml`, `nginx/`
  - **Stray files:** `README.txt`, `10.8.3`, `frontend@0.0.0`
  - **Old frontend build and deploy files:** `frontend/Dockerfile` (the dev-only one), `frontend/nginx.conf`, `frontend/public/_redirects`, `frontend/.github/`
  - **Keep** `frontend/dockerfiles/` only if used. Otherwise delete it too.
- Modify: `README.md`, which describes the new architecture, the dev stack, seeding and the bot.

- [ ] **Step 1: Run the full checks.**
  - `cd api && uv run pytest -m "integration or not integration" -q` → all pass.
  - `uv run ruff check .` → clean.
  - `cd ../frontend && yarn test && yarn build` → pass.
- [ ] **Step 2: Do the end-to-end checks on the dev stack, from a clean start.** Start with `docker compose -f compose.dev.yml down -v && … up -d --build && … exec api python -m eventopia.seed`.
  - Telegram sign-up with a real phone.
  - Website OTP login.
  - Every flow from Task 20 Step 4.
  - The bot restarts without replaying old updates: `docker compose restart bot`, then send `/start` once and get exactly one reply.
- [ ] **Step 3: Confirm nothing secret is tracked.** `git grep -nE "AAH|sk-[0-9a-f]{8}|BEGIN PRIVATE KEY|gZuSG7" -- . ':!docs'` → no matches.
- [ ] **Step 4: Commit.** `git commit -m "chore: remove Django backend and Azure leftovers; document the new stack"`
