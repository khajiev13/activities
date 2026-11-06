# Eventopia on FastAPI with Telegram sign-in: design

- **Date:** 2026-11-07
- **Status:** ready for the owner's review. A builder check has been done, and its 4 questions are settled in §6.6, §6.7, §6.9, §6.10 and calls 12–14.
- **Sub-project:** 1 of 6 (see "Later sub-projects")
- **Background:** `docs/plans/2026-11-07-revival-analysis.md` (code audit, server survey, version research)

## 1. Why

Eventopia is a graph-backed social app for sports activities, teams and organizations. It was last touched in February 2025, and it ran on Azure with Neo4j Aura and username/password logins. The owner is reviving it for users in Uzbekistan, where almost everyone uses Telegram.

So Telegram becomes the identity. People sign up in the bot **@eventopiarobot** by sharing their own phone number, and there are no passwords. A Telegram Mini App and notifications (for example "team A invites team B to a match") come later, so this design must make both easy to add.

**What "done" means here:** the existing web app works end to end on a new FastAPI backend, and Telegram is the only way in.

## 2. Goals, non-goals, anti-goals

### Goals
1. Replace the Django backend with a FastAPI service. It must cover every endpoint the React app calls today (Appendix A), with known bugs fixed and writes behind login.
2. Telegram sign-up: in @eventopiarobot the user presses Start, then shares **their own** phone number. That creates the account.
3. Website login by one-time code (OTP): the user types a phone number, the bot sends a 6-digit code to the linked Telegram chat, and the user types it on the website.
4. Silent login for the future Mini App: a backend endpoint swaps Telegram's signed `initData` for a session, with no codes involved.
5. All authentication data lives in **SQLite**. Profiles and the social graph live in **Neo4j**.
6. Uploaded images live in **Silo** (the maintained MinIO fork) through the S3 API, replacing Azure Blob.
7. One-command local development stack (Docker Compose). Seed data loads with one command.
8. Tests first. Every endpoint in Appendix A has a contract test.

### Non-goals (this sub-project)
- Deployment to the home server, Caddy, Cloudflare Tunnel, domain, backups. That is sub-project 2.
- The Mini App UI, BotFather Mini App setup, and the Telegram `requestContact` flow inside the Mini App. That is sub-project 3. Only the backend endpoint from goal 4 is built now.
- Notifications and background workers. That is sub-project 4.
- The LLM graph chatbot. It is parked, and the frontend hides its entry point.
- Browsing or joining activities from the bot chat. The bot handles sign-in and, later, messages only.
- New features for leagues, competitions, achievements, join requests, substitutions or score info.
  - Leagues are seeded, but none of these get endpoints.
  - The existing "competition" option on an activity (team 1 vs team 2) **keeps working** (§6.6). Scores and results do not.
- Profile editing, avatars for new users, update or delete for activities, teams and organizations. The frontend has no UI for any of these.
- Upgrading frontend dependencies to new major versions (React 19, Router 7, Vite 8, Tailwind 4).
- Migrating data from the old Neo4j Aura instance. We start from seed data.

### Anti-goals (this would count as failure even if it technically works)
- The bot or the Mini App ever asks the user to copy a code or token. Inside Telegram, login happens on its own.
- A browser request can attach any phone number to an account. Phones are accepted **only** from Telegram contact-sharing, and only when the contact belongs to the sender.
- Passwords exist anywhere.
- Authentication data (codes, sessions, Telegram identities, phones) is stored in Neo4j.
- The site reveals whether a phone number is registered.

## 3. Constraints

- **Architecture follows the `python-service-patterns` skill:**
  - layered views → services → data access
  - one service class per domain, dependencies passed in through the constructor, wiring in one place
  - Pydantic at the system boundaries, dataclasses internally
  - a domain exception hierarchy with one global handler
  - YAML config per environment
  - the skill's response envelope
- **Telegram limits:**
  - A bot can only message users who have pressed Start in its chat.
  - Phone numbers are only available through contact sharing. Telegram's Login Widget does not provide them.
  - The bot currently has no webhook set, and there is no domain yet, so the bot uses **long polling**.
- **Latest stable versions**, verified on 2026-11-07 (§12). The builder re-checks them when starting.
- **Neo4j Community edition:** there is no role-based access control, and a full dump requires stopping the database. New databases default to **Cypher 25**.
- **Development machine:** Apple Silicon (arm64). The production target is amd64 (Ubuntu 22.04, 5.7 GB RAM), so images must be multi-arch.
- **Secrets** (bot token, JWT keys, S3 keys, Neo4j password) live only in git-ignored YAML files. The repository is public and already leaked credentials once.

## 4. Approaches considered (how the code talks to Neo4j)

| | Approach | Trade-off |
|---|---|---|
| **A** | **The plain `neo4j` async driver, plus Cypher repository modules that return Pydantic models.** Constraints come from a script that is safe to re-run. | More Cypher written up front (about 85 neomodel helper calls become explicit queries). In return there is one way to query, the latest driver (6.4.1), and no surprises from a mapping layer. It fits the skill's data-access layer exactly. |
| B | neomodel 7 for models and simple create/read/update/delete, Cypher for the graph queries | Keeps the 17 model classes. But it means two ways to query the same data, neomodel 7 pins the driver to 6.1, and its strict cardinality and silently ignored property options caused several of the current bugs. |
| C | neomodel for everything | Ruled out. Graph queries such as "teams near me" don't fit an ORM, and the current code already falls back to raw Cypher. |

**Picked: A** (the owner chose it on 2026-11-07).

## 5. Decisions made by the owner

1. Rewrite the backend in FastAPI, following `python-service-patterns`.
2. Telegram-only identity, with the phone shared in the bot. No passwords.
3. Inside Telegram (bot, Mini App) there are no codes; login is automatic. On the website, login is by phone number plus an OTP sent by the bot.
4. All authentication data is in SQLite.
5. The bot does sign-in and messages only. (Proposed by the author; the owner did not object.)
6. The chatbot is parked.
7. Neo4j access uses approach A.
8. Configuration and secrets are in YAML files, as the skill describes. The bot token is already in a git-ignored `config-local-dev.yaml`.

## 6. Design

### 6.1 Repository layout

The new service lives in **`api/`**. Django's `backend/` stays as read-only reference until every contract test passes, then the last task deletes it.

```
api/
├── pyproject.toml / uv.lock
├── config.example.yaml          # committed; every key, placeholder values
├── config-local-dev.yaml        # git-ignored; real dev values (bot token moves here from repo root)
├── main.py                      # API entry: load config → wire → create_app → uvicorn
├── bot_main.py                  # bot entry: load config → wire → run poller
├── alembic.ini, migrations/     # SQLite schema (Alembic)
├── eventopia/
│   ├── __init__.py              # create_app(container) → FastAPI
│   ├── config.py                # YAML loading + TypedDict sections + required-key check
│   ├── wiring.py                # the ONLY place objects are constructed (manual DI container)
│   ├── exceptions.py            # ServiceException hierarchy + error codes
│   ├── context/                 # Neo4jConnector, SqliteConnector, request-id middleware
│   ├── models/                  # Pydantic request/response models; dataclasses for internals
│   ├── services/                # AuthService, OtpService, AccountService, TelegramService,
│   │                            # ActivityService, TeamService, OrganizationService, LocationService,
│   │                            # CategoryService, GeoService, MediaService
│   ├── cyphers/                 # Neo4j data access: one module per domain, typed async functions
│   ├── sqls/                    # SQLite data access (auth): accounts, telegram, otp, sessions, bot_state
│   ├── views/                   # one class per domain; constructor-injected services; exposes .router
│   ├── telegram/                # TelegramGateway (abstract) + HttpTelegramGateway (httpx) + fakes for tests
│   ├── bot/                     # poller loop + update handlers (thin; call services) + message texts
│   ├── storage/                 # ObjectStorage (abstract) + S3ObjectStorage (boto3)
│   ├── schema/                  # constraints.cypher + apply script
│   └── seed/                    # seed command + data/ (moved from backend/core/data)
└── tests/
```

**Naming:** the skill's `sqls/` layer is for SQLite. The Neo4j equivalent is `cyphers/`. Nobody has to guess which store a query touches.

### 6.2 Processes (development)

`compose.dev.yml` at the repo root:

| Service | Image or command | Notes |
|---|---|---|
| `neo4j` | `neo4j:2026.10.1-community-trixie` | No APOC (nothing needs it any more). Heap 512m, page cache 384m. Ports 7474/7687 on localhost only. Volume `neo4j-data`. |
| `silo` | `pgsty/silo:RELEASE.2026-10-26T00-00-00Z` | `server /data --console-address :9001`. Console on localhost:9001. Volume `silo-data`. |
| `silo-init` | same image, one-shot | `mcli`: create bucket `media`, `anonymous set download media/public`, create the app user and key, attach `readwrite`. |
| `api` | `python:3.13-slim-trixie` + uv | Entrypoint: `alembic upgrade head` → apply Neo4j constraints → `uvicorn main:app --reload`. Mounts `api/` and the volume `auth-data` (SQLite). |
| `bot` | same image as `api` | `python bot_main.py`. Mounts `auth-data`. Starts after `api` is healthy, so migrations have run. |
| `web` | `node:22-alpine` | `yarn dev --host`, port 5173. Vite proxies `/api` → `api:8000` and `/media` → `silo:9000`. |

- **Exactly one `bot` process may run per bot token.** Telegram rejects concurrent `getUpdates` calls.
- **The API never polls Telegram.** It only calls `sendMessage` to deliver codes.

### 6.3 Configuration

- **Which file loads:** the file named by `EVENTOPIA_CONFIG`, default `config-local-dev.yaml`.
  - Files: `config.yaml` (prod), `config-dev.yaml`, `config-local-dev.yaml`. All are git-ignored; only `config.example.yaml` is committed.
  - The root `.gitignore` already ignores `config-*.yaml` except the example. Add `api/config.yaml` too.
- **Shape:** sections are TypedDicts, as the skill says. The loader fails fast if a required key is missing.
- **When it's read:** services read config in their constructors, never per request.

```yaml
app:      { public_base_url: "http://localhost:5173", cors_origins: [], log_level: INFO }  # same-origin via Vite proxy / Caddy; no CORS
neo4j:    { uri: "bolt://neo4j:7687", user: neo4j, password: "...", database: neo4j }
sqlite:   { path: "/data/auth/eventopia.sqlite3" }
auth:     { jwt_secret: "...", access_ttl_seconds: 900, refresh_ttl_days: 30, refresh_reuse_grace_seconds: 30,
            refresh_cookie_name: eventopia_refresh, cookie_secure: false, otp_pepper: "...",
            otp_ttl_seconds: 300, otp_max_attempts: 5, otp_resend_seconds: 60,
            otp_max_per_phone_per_hour: 5, otp_max_per_ip_per_hour: 20,
            webapp_init_data_max_age_seconds: 86400, default_phone_region: UZ }
telegram: { bot_token: "...", bot_username: eventopiarobot, poll_timeout_seconds: 50 }
s3:       { endpoint_url: "http://silo:9000", access_key: "...", secret_key: "...", bucket: media,
            region: us-east-1, public_prefix: public, max_upload_bytes: 5242880 }
```

### 6.4 Layers, wiring, envelope, errors

- **Views:** one class per domain, for example `TeamsView(team_service, auth_service)`. It builds a FastAPI `APIRouter` in `__init__` and exposes it as `.router`.
  - Handlers parse input, call services and return models. They contain no business logic.
  - The current user comes from a dependency built from the injected `AuthService`. There is no service locator.
- **Wiring:** `wiring.py` builds every connector, gateway, service and view once at startup, as singletons, and `create_app` includes each view's router.
  - The bot builds its own container from the same wiring code. It needs a subset of the objects.
- **Services:** plain classes with no FastAPI imports, so the bot process can reuse them.
- **Neo4j data access:** `cyphers/*.py` functions take an async transaction and return Pydantic models or dataclasses.
  - Queries are always parameterized.
  - `Neo4jConnector` hands out `read()` and `write()` transaction contexts. They use `session.execute_read` and `execute_write` (managed transactions with retries).
- **SQLite data access:** `sqls/*.py` functions take an `AsyncSession`. `SqliteConnector` owns the engine and session factory.
- **Envelope (skill):** every response body is `{"requestId": "<uuid>", "error": 0, "data": <payload>}`.
  - Payload field names stay **snake_case**, matching what the React app already reads.
  - The frontend axios client unwraps `data` in a response interceptor, so component code keeps the shapes it has today.
- **Errors:** `ServiceException(code, message, http_status)` and subclasses (`AuthError`, `NotFoundError`, `ConflictError`, `ValidationError`, `RateLimitedError`).
  - One global handler returns `{"requestId", "error": <code ≠ 0>, "message"}` with the matching HTTP status. **401 stays 401**, because the frontend refresh logic depends on it.
  - Unknown exceptions are logged with a traceback and returned as 500, code 500, with a generic message.
  - Request validation errors return 422, code 200, plus field details.
- **Logging:** module-level `_logger` with lazy `%` formatting. Every log line carries the request ID.
  - **Never log** phone numbers in full (mask as `+998 90 *** 4567`), codes, tokens or the bot token.

### 6.5 Identity and authentication

#### Data split
- **SQLite** holds accounts, Telegram identities, verified phones, OTP challenges, refresh sessions and bot polling state.
- **Neo4j** holds the `USER` profile node, keyed by the same `uid`.
- Every login runs `AccountService.ensure_profile(uid)`. It creates the `USER` node with `MERGE` if it is missing, so a sign-up that half-failed repairs itself. Nothing ever spans both databases in one transaction.

#### SQLite schema (Alembic)

| Table | Columns |
|---|---|
| `accounts` | `uid TEXT PK` (UUID4), `status` (`active`/`disabled`), `created_at` |
| `telegram_identities` | `account_uid FK UNIQUE`, `telegram_user_id INTEGER UNIQUE`, `chat_id INTEGER`, `phone_e164 TEXT UNIQUE NULL`, `phone_verified_at`, `username`, `first_name`, `last_name`, `language_code`, `chat_active BOOL`, `chat_status_changed_at`, `updated_at` |
| `otp_challenges` | `id TEXT PK`, `phone_e164`, `account_uid NULL`, `code_hash`, `created_at`, `expires_at`, `attempts INT`, `consumed_at NULL`, `superseded_at NULL`, `requester_ip`, `delivered BOOL` |
| `refresh_sessions` | `id TEXT PK`, `account_uid FK`, `family_id`, `token_hash UNIQUE`, `issued_at`, `expires_at`, `revoked_at NULL`, `replaced_by NULL`, `user_agent`, `ip` |
| `bot_state` | `key TEXT PK`, `value TEXT` (holds `getUpdates` offset) |

- **SQLite settings:** WAL journal, `busy_timeout=5000`, foreign keys on. Two processes (`api` and `bot`) share the file.
- **Engine:** SQLAlchemy 2.1 async with aiosqlite.

#### Phone rules
- Normalize with `phonenumbers` to E.164, default region `UZ`. Telegram contact numbers can lack the `+`; add it before parsing.
- **One verified phone per identity, one identity per phone.**
- **If a phone is re-verified by a different Telegram user** (for example, a carrier recycled the number): the newest verification wins. The old identity's phone is cleared, its refresh sessions are revoked, and a warning is logged (masked).

#### Sign-up in the bot (long polling)
- **Polling:** `getUpdates` with `allowed_updates=["message","my_chat_member"]`. The offset is saved in `bot_state`, so a restart neither drops nor replays updates. Only private chats are handled; groups are ignored.
- **`/start`, or any message from a user without a verified phone:**
  - Show a short welcome.
  - Show a reply keyboard with a single button, "📱 Share my phone number" (`request_contact: true`, one-time).
- **A `contact` message:**
  - Accept it only if `contact.user_id == message.from.id`. Otherwise reply "Please use the button to share your own number."
  - On acceptance, in one SQLite transaction: create the account if it's new, upsert the Telegram identity, set the phone and `phone_verified_at`, set `chat_active=true`.
  - Then call `ensure_profile`, which creates the Neo4j `USER` (§6.6).
  - Reply with a confirmation, remove the keyboard, and tell the user how to log in on the website: "enter this phone number at <public_base_url>/login".
- **Registered user sends `/start`:** reply "You're registered as @<username>. Log in on the website with +998 90 *** 4567." Offer `/phone` to change the number.
- **`/phone`:** shows the share button again. The new contact replaces the old phone under the same rules.
- **`my_chat_member`:** status `kicked` sets `chat_active=false`; `member` sets it to `true`.
- **Every update** refreshes the identity's username and names and marks the chat active.
- **Language:** bot texts in Uzbek (Latin), Russian and English, chosen from Telegram `language_code` (`uz`, `ru`, otherwise English). Kept in one module.

#### Website login by OTP
1. **`POST /api/auth/otp/request {phone}`**
   - Normalize the number. An invalid format returns 422.
   - Rate limits:
     - per phone: one request per `otp_resend_seconds`, and `otp_max_per_phone_per_hour`
     - per IP: `otp_max_per_ip_per_hour`
     - Over a limit returns 429 with `retry_after`.
   - **If** an identity with that verified phone exists and `chat_active`:
     - Supersede any open challenge for that phone.
     - Create a new challenge with a random 6-digit code. `code_hash = HMAC-SHA256(otp_pepper, challenge_id + ":" + code)`.
     - Send it with `sendMessage(protect_content=true)`. The message says the code and its expiry, that it should never be shared, and that it can be ignored if not requested.
     - If Telegram returns 403 (bot blocked), set `chat_active=false`.
   - **Always** return the same success payload `{retry_after_seconds}`, whether or not a code was sent, so phones can't be probed.
2. **The website's code screen** says: "If this number is registered, we sent a code to your Telegram. Not registered or no message? Open @eventopiarobot and press Start." Link: `https://t.me/eventopiarobot`.
3. **`POST /api/auth/otp/verify {phone, code}`**
   - Find the newest open, unexpired challenge for the phone.
   - Increment `attempts`. Past `otp_max_attempts` the challenge is dead.
   - Compare hashes in constant time.
   - On success: mark it consumed, call `ensure_profile`, and issue a session (below).
   - Every failure returns the same 401 code 102, "invalid or expired code".

#### Mini App login (backend only, for sub-project 3)
- **`POST /api/auth/telegram/webapp {init_data}`**
  - Validate per the Telegram docs: secret = HMAC-SHA256(key "WebAppData", bot_token), then HMAC of the sorted data-check-string, compared in constant time.
  - Reject `auth_date` older than `webapp_init_data_max_age_seconds`.
- **If the Telegram user has an identity with a verified phone:** ensure the profile and return an access token. No refresh token and no cookie (see Sessions below).
- **Otherwise:** return 403 code 103, `phone_required`.
  - The Mini App will then call Telegram's `requestContact`. The contact arrives in the bot chat and the poller verifies it with the same rule.
  - The Mini App retries afterwards.

#### Sessions and tokens (decided by the owner: the best-practice option for each place the app runs)

Nothing auth-related is ever written to `localStorage` or `sessionStorage`.

- **Access token (both places):** a JWT (PyJWT, HS256) lasting 15 minutes. Claims: `sub=uid`, `username`, `typ=access`, `iat`, `exp`.
  - Sent as `Authorization: Bearer`.
  - The frontend keeps it **in memory only**, in a module-level variable, not in storage.
- **Inside Telegram (Mini App):**
  - **No cookies and no refresh token.**
  - On launch, and whenever the access token expires, the app sends `Telegram.WebApp.initData` (raw and unmodified) to `POST /api/auth/telegram/webapp` and gets a fresh access token.
  - Why no cookies: Telegram Web runs Mini Apps inside an iframe, where browsers block or partition cookies. And `initData` is available on every launch anyway.
- **On the website (browser):**
  - **The refresh token lives in an HttpOnly cookie**, so injected scripts can't read it.
  - **Cookie:** name `eventopia_refresh`, flags `HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=30 days`.
    - `Secure` is controlled by `auth.cookie_secure`, which is false only in local HTTP development.
  - **Value:** opaque random (32 bytes, URL-safe), stored only as SHA-256 in `refresh_sessions`.
  - **Page load:** the app calls `POST /api/auth/refresh`. If the cookie is valid it gets an access token. If not, the user is logged out.
  - **`POST /api/auth/refresh`:** rotates the token. The old one is revoked and points to the new one through `replaced_by`, and the new cookie is set.
  - **Reuse detection:** presenting a token that was already rotated revokes the whole `family_id`.
    - **Exception, the 30-second grace window:** a token that was rotated within the last 30 seconds gets a new access token, without rotating or revoking anything. Two tabs refreshing at once would otherwise log the user out. The browser already holds the newer cookie.
  - **`POST /api/auth/logout`:** revokes the session in the cookie and clears the cookie.
  - **CSRF protection:** the API is same-origin with the site and allows no cross-origin requests. The cookie is `SameSite=Strict` and only sent to `/api/auth`. `refresh` and `logout` also require the header `X-Requested-With: eventopia`, which a cross-site form cannot send.
- **Login responses** (`otp/verify`, `telegram/webapp`) return `{access_token, user: {uid, username, first_name, last_name, image_url}}`.
  - `otp/verify` also sets the refresh cookie.
  - `telegram/webapp` never sets a cookie.
- **Disabled accounts:** an account with `status=disabled` can't log in, and its access tokens are refused on the next request (the account is checked per request against a small in-process TTL cache, up to 60 s).

### 6.6 Graph model (Neo4j)

- **Labels are unchanged** (`USER`, `TEAM`, `ACTIVITY`, `COMPETITION`, `ORGANIZATION`, `LOCATION`, `CITY`, `STATE`, `COUNTRY`, `CATEGORY`, `COLOR`, `LEAGUE`), so the existing Cypher ports with few edits. `ROLE` is no longer used: a player's position lives on the membership (below).
- **All queries must be valid Cypher 25:**
  - `elementId()`, never `id()`
  - `randomUUID()` instead of `apoc.create.uuid()`
  - `CALL (x) { … }` scoped subqueries

**`USER` node:**
- Properties: `uid` (unique), `username` (unique handle used in URLs), `first_name`, `last_name`, `image_url`, `gender` (optional), `birth_date` (optional), `created_at`, `claimed` (true for real accounts, false for seeded players).
- Username rule: the Telegram username, lowercased, if it is valid (`[a-z0-9_]{3,32}`) and free. Otherwise a slug of the first name plus 4 random digits, retried until unique.
- Profile data such as name and image never holds auth data.

**Other keys:** `TEAM.name` (unique, used in URLs); `pk` (UUID string, unique) on `ACTIVITY`, `COMPETITION`, `ORGANIZATION`, `LOCATION`, `CATEGORY`; `name` unique on `CITY`, `STATE`, `COUNTRY`, `COLOR`, `LEAGUE`.

**Constraints and indexes:** `schema/constraints.cypher` holds them, written as `CREATE CONSTRAINT … IF NOT EXISTS`, plus a point index on `LOCATION.points`. It runs at startup and is safe to re-run.

**Geo:** `LOCATION.points` is a native WGS-84 `point({latitude, longitude})`. The geo hierarchy uses `IS_IN`: LOCATION → CITY → STATE → COUNTRY.

**Standard relationship names.** The audit found drift between the models and the Cypher. This table is now the standard, and the seed and every query use exactly these names:

| Pattern | Notes |
|---|---|
| `(USER)-[:IS_MEMBER_OF {joined_at, player_number, name_on_jersey, position, plays_for_division}]->(TEAM)` | `position` ∈ Goalkeeper / Defender / Midfielder / Forward, so a player can have a different position in each team. `plays_for_division` is set by the seed and null for people who join through the app. This replaces the old `(USER)-[:IS]->(ROLE)-[:IN]->(TEAM)` pattern, which couldn't say which position belongs to which team. |
| `(ACTIVITY)-[:IS_COMPETITION]->(COMPETITION {pk})-[:TEAM_1]->(TEAM)`, `(COMPETITION)-[:TEAM_2]->(TEAM)` | Existing pattern, kept. Activity payloads always carry `competition: {team_1: {name, image_url}, team_2: {name, image_url}}`. For a non-competition activity, the names and images are `null`. This is the shape `frontend/src/types/ActivitiesListSchema.ts` already expects, so the frontend needs no change. |
| `(USER)-[:CREATES]->(ACTIVITY \| ORGANIZATION \| TEAM)` | TEAM is new; it records ownership |
| `(USER)-[:JOINS]->(ACTIVITY)` | |
| `(USER)-[:IS_FROM]->(COUNTRY)`, `(USER)-[:BASED_IN]->(LOCATION)`, `(USER)-[:LIKES]->(CATEGORY)` | |
| `(USER)-[:BELONGS_TO {since}]->(ORGANIZATION)` | Membership |
| `(TEAM \| ACTIVITY \| ORGANIZATION \| LEAGUE)-[:CITY_BASED_IN \| STATE_BASED_IN \| COUNTRY_BASED_IN]->(CITY \| STATE \| COUNTRY)` | Replaces the model's plain `BASED_IN` for ACTIVITY |
| `(TEAM)-[:BASED_IN]->(LOCATION)`, `(ACTIVITY)-[:HAPPENS_AT]->(LOCATION)`, `(ORGANIZATION)-[:LOCATED_AT]->(LOCATION)` | |
| `(TEAM \| ACTIVITY \| LEAGUE)-[:IS_TYPE_OF]->(CATEGORY)`, `(LOCATION)-[:HAS_FACILITY]->(CATEGORY)` | |
| `(TEAM)-[:TSHIRT_COLOR \| SHORTS_COLOR \| SOCKS_COLOR \| AWAY_TSHIRT_COLOR]->(COLOR)` | |
| `(ORGANIZATION)-[:HAS_TEAM]->(TEAM)` | Replaces `HAS` / `BELONGS_TO` between team and org |
| `(ORGANIZATION)-[:SPONSORS {since: date}]->(TEAM)` | |
| `(ORGANIZATION)-[:HOSTS]->(ACTIVITY \| LEAGUE)`, `(TEAM)-[:PARTICIPATES_IN]->(LEAGUE \| ACTIVITY)` | |

Out-of-scope domains (competitions, achievements, score info, substitutions, join requests) get no repositories now. Their old models stay in git history as a reference for later.

### 6.7 API surface and permissions

- **Contract:** Appendix A lists every endpoint.
- **Paths:** exactly as the React app calls them today, trailing slashes included. Routes must not answer with redirect responses. The only exception is auth, which moves to `/api/auth/*`, and the frontend is updated to match.
- **Reads** are public, except anything with personal data:
  - `/api/users/me` needs login.
  - Member lists show username, name, image and jersey info only.
- **Writes** need a valid access token.
- **Creating** an activity, team or organization records `(USER)-[:CREATES]->(...)`.
- **Joining:**
  - Join and leave on an activity act only for the caller.
  - Join on a team takes `{name_on_jersey, player_number, position}`. It returns 409 if the caller is already a member, or if that number is taken in that team.
- **Team member lists** show username, name, `image_url` (may be null), jersey name and number, position (returned as `role`, the field the frontend already reads) and `plays_for_division` (may be null). Gender is not included.
- **Removed:** endpoints with no frontend caller are dropped. That covers the user list and detail CRUD, colors CRUD, states list, categories sub-resources, activity, team and organization detail update and delete, organization detail, and every old `/api/users/token/*` route.
- **Fixed while porting** (the bugs from the audit, so they don't come back):
  - organization search ignored its filter
  - list endpoints crashed when given no filter
  - inflated `COUNT`s from the category join
  - duplicate entries from `collect()` without `DISTINCT`
  - `people_joined` listed the creator instead of the people who joined
  - `MERGE` crashed on a null `founded_at` or color
  - ISO timestamps without milliseconds were rejected

### 6.8 Media (Silo, S3 API)

- **Interface:** `ObjectStorage` with methods `put(key, bytes, content_type)`, `delete(key)` and `public_url(key)`. `S3ObjectStorage` implements it with boto3, run in a worker thread so it doesn't block the event loop.
  - **boto3 checksum setting:** set `request_checksum_calculation` and `response_checksum_validation` to `when_required`. boto3 ≥ 1.36 defaults to CRC32 checksums.
  - Use path-style addressing and SigV4 signatures.
- **`MediaService.upload_image(kind, upload)`:**
  - Accepts JPEG, PNG or WebP, detected from the file's leading bytes, not trusted from the client.
  - Size limit: `max_upload_bytes`, 5 MB.
  - Key: `public/{kind}/{uuid4}.{ext}`, where kind is `teams` or `organizations`.
  - Returns the **absolute** URL `{public_base_url}/media/public/...`, because the frontend's zod schemas require URLs.
- **Deleting media** is best effort and never fails the request.
- **Serving:** the bucket allows anonymous download on `public/` only. In development, Vite proxies `/media` to Silo. In production, Caddy does it (sub-project 2).

### 6.9 Seed data

`python -m eventopia.seed` is safe to re-run. It loads `seed/data/*.json` (moved from `backend/core/data`) and creates:
- 48 teams with random colors and Beijing locations.
  - The files contain 48 squads but only 42 distinct names: Afrika Utd, Añejo FC, Sexy FC, Beijing Celtic, Beijing Rockets and Beijing Huojian each also have a 7-a-side squad.
  - Every squad from a `*_7s.json` file is named `"<name> 7s"`, so each squad is its own team with its own URL and roster.
  - A squad from `female_division_1.json` gets `men_team=false`.
  - Each membership stores the player's `position` and the division from the file name.
- 3 leagues, hosted by "Beijing Football Association"
- 4 pitches
- the China → Beijing geo hierarchy
- the Soccer category
- players as `USER {claimed: false}` with a generated unique `uid` and username, linked with `IS_MEMBER_OF`

**Bugs fixed at the same time:**
- **Duplicate usernames:** usernames were the first name plus one letter, so different people merged into one account.
- **Birthdates, emails and passwords:** no longer stored.
- **Women's teams:** were seeded as men's teams.
- **7-a-side squads:** never got their players.

The fixtures and results files stay unloaded.

### 6.10 Frontend changes in scope (just enough to work end to end)

1. **API client:**
   - `baseURL` comes from `VITE_API_BASE_URL` (default `/`).
   - Every path is normalized to `/api/...`.
   - Vite dev proxy for `/api` and `/media`.
   - A response interceptor unwraps the envelope's `data`.
2. **Login page:**
   - Phone input (default +998), then a 6-digit code input.
   - "Resend" button with a countdown.
   - The no-message hint with the @eventopiarobot link.
   - The password form is removed.
3. **Register page:** replaced by a "Sign up in Telegram" screen. It links to `https://t.me/eventopiarobot`, with a QR code for desktop. All registration form code is removed.
4. **Auth handling (§6.5 Sessions):**
   - **Token storage:**
     - The access token is kept in memory only.
     - Remove every `localStorage` use for tokens and profile fields; profile data comes from the login response and `/api/users/me`.
     - Requests use `withCredentials` so the refresh cookie goes along.
   - **Startup:** the app calls `/api/auth/refresh` with the `X-Requested-With: eventopia` header.
   - **Refresh on 401:** refresh is triggered by HTTP 401 (not `statusText`), and it is single-flight: parallel 401s share one refresh.
   - **Logout:** calls `/api/auth/logout`, then clears the in-memory token. The theme setting stays.
   - **Route guard:** sends write actions to `/login`.
   - **Inside Telegram:** an auth strategy switch picks the `initData` exchange when `window.Telegram?.WebApp?.initData` is present. The Mini App work (sub-project 3) builds on it.
5. **Build passes:**
   - Pin `@types/react` and `@types/react-dom` to 18.
   - Remove the Next.js imports and the `process.env` define.
   - Sourcemaps off for production builds.
6. **Core flows that must work:**
   - **Team drawer:** fix the crash on open.
   - **Join Team button:** wire it to the join endpoint with a small form: jersey name, number, and position (select from the four positions).
   - **Team page schema** (`src/types/TeamDetailsSchema.ts`, the only schema checked at runtime): drop the member `gender`; allow member `plays_for_division` and `image_url` to be null. In `TeamsListingSchema.ts`, team `image_url` becomes `z.string().url().nullable()`. Without this, the first Telegram user to join a team, or any team without an image, breaks that team's page.
   - **Competitions:** creating a competition (team 1 vs team 2) keeps working. The backend always returns the `competition` object (§6.6), so the activity components need no change.
   - **Image fields:** fix the `accept` attribute and the `'link'` fallback.
   - **Chatbot:** hide its entry.
7. **MapTiler key:** read from `VITE_MAPTILER_KEY`. The committed key gets rotated as part of the credential hygiene; it is not this build's job.

### 6.11 Testing

- **Tools:** pytest 9 with pytest-asyncio. Neo4j runs in testcontainers. Each test gets a fresh temporary SQLite file.
- **Telegram:** `FakeTelegramGateway` records sent messages and can simulate a 403. Bot handlers are tested by feeding them recorded update payloads.
- **Storage:** `FakeObjectStorage` (in memory) for unit tests, plus one integration test against a real Silo container.
- **Contract tests:** every Appendix A endpoint gets status, envelope and payload keys, matching what the React app reads (its zod schemas in `frontend/src/types` and its components).
- **Auth tests:**
  - foreign-contact rejection
  - phone takeover by a new identity
  - OTP expiry, attempts, resend cooldown, supersede, rate limits
  - identical responses for unknown and known phones
  - refresh rotation, reuse detection, and the 30-second grace window
  - refresh-cookie flags (`HttpOnly`, `SameSite=Strict`, `Path=/api/auth`, `Secure` when configured)
  - `refresh` and `logout` rejected without `X-Requested-With`
  - `telegram/webapp` never setting a cookie
  - `initData` validation with tampered and expired data
  - `ensure_profile` repairing a missing USER node
- **Discipline:** tests are written first (TDD).

### 6.12 Versions (verified on PyPI and Docker Hub, 2026-11-07)

Python 3.13; uv 0.13.7 (lockfile)

| Area | Packages / images |
|---|---|
| Web framework | fastapi 0.162.0, uvicorn 0.54.0, python-multipart 0.0.33 |
| Neo4j | neo4j driver 6.4.1 |
| SQLite and migrations | sqlalchemy 2.1.8, aiosqlite 0.22.1, alembic 1.20.1 |
| Auth helpers | pyjwt 2.15.1, phonenumbers 9.0.43 |
| HTTP, S3, config | httpx 0.28.1, boto3 1.43.x, pyyaml 6.0.3 |
| Testing and linting | pytest 9.2.0, pytest-asyncio 1.4.1.post1, testcontainers 4.15.0, ruff 0.17.4 |
| Images | `neo4j:2026.10.1-community-trixie`, `pgsty/silo:RELEASE.2026-10-26T00-00-00Z`, `python:3.13-slim-trixie`, `node:22-alpine` |

## 7. Left to the builder

- **Exact response fields per endpoint:** derive them from the frontend's zod schemas and component usage, with the old serializers and Cypher as a cross-check. Contract tests pin them down.
- **Cypher rewrites:** must keep the result shapes and follow §6.6. Read-heavy queries may be restructured freely.
- **Error-code numbering** beyond the codes named here, and the exact bot and website message wording and translations.
- **Module and file names within each layer;** whether views use a small `ApiView` base class.
- **Rate-limit bookkeeping:** counting rows in `otp_challenges` is fine at this scale. No Redis.
- **Task order inside the plan,** as long as tests come first.

## 8. Later sub-projects (not designed here)

| # | Sub-project | Notes |
|---|---|---|
| 0 | Credential hygiene | Rotate the leaked Aura password, GCP key, DeepSeek key and MapTiler key. Merge `dev` → `main`. Archive the old repos. **Revoke the bot token** that was shared in chat before going public. |
| 2 | Home-server deployment | Unmask Docker, clean up, prod compose, Caddy, Cloudflare Tunnel, domain choice, backups (Neo4j offline dump plus nightly export, Silo mirror, SQLite `.backup`), production seed data. |
| 3 | Telegram Mini App | Same React app inside Telegram, BotFather main-app setup, `requestContact`. |
| 4 | Notifications and workers | A durable outbox and worker, as in cargo_telegram_bot. Events: team invites, messages. Reuses `TelegramGateway` and `chat_active`. |
| 5 | Chatbot revival | langchain-neo4j, DeepSeek, read-only guard. |
| 6 | Frontend upgrades | React 19, Router 7, Vite 8, Tailwind 4, zod 4, MapTiler SDK 4. |

## 9. Calls made by the author (please check)

1. The bot is sign-in and messages only, with no browsing in chat.
2. The OTP response is identical for registered and unknown numbers. The page points people to the bot instead of saying "not registered".
3. OTP parameters: 6 digits, 5 minutes, 5 attempts, 60-second resend, 5 per phone per hour, 20 per IP per hour. Codes are sent with `protect_content`.
4. If a number is recycled, the newest Telegram verification of a phone wins. The previous holder loses the phone and their sessions.
5. **Owner decided 2026-11-07: the best-practice option for each place.**
   - Website: access token in memory, plus a refresh token in an HttpOnly `SameSite=Strict` cookie that lasts 30 days, rotates, and revokes its whole family on reuse (30-second grace for tabs refreshing at once).
   - Mini App: an `initData` exchange on launch and on expiry, with no cookies and no refresh token.
   - Access tokens last 15 minutes. Nothing is stored in localStorage.
6. The skill's response envelope is adopted. Payloads stay snake_case, and the frontend unwraps `data` in one interceptor.
7. Endpoints with no frontend caller are dropped. Only the creator relationship is recorded; there is no edit or delete yet.
8. Bot texts are in Uzbek (Latin), Russian and English.
9. Seeded players keep their real names but lose birthdates. They become unclaimed profiles, and claiming one is a later feature.
10. No APOC. The new code lives in `api/`, and `backend/` is deleted at the end.
11. Uploaded images get absolute URLs built from `public_base_url`.
12. Competition activities (team 1 vs team 2) keep the existing `COMPETITION` node pattern. Non-competition activities return the `competition` object with null names and images, as the frontend types expect.
13. Seeded 7-a-side squads are named `"<name> 7s"` (48 teams, not 42 merged ones).
14. A player's position is stored per team on the membership. Joining asks for jersey name, number and position. Team member lists no longer include gender.

---

## Appendix A: Endpoint contract

All responses use the envelope (§6.4). "User" means a valid access token is required.

| Method | Path | Auth | Request | Notes |
|---|---|---|---|---|
| POST | `/api/auth/otp/request` | public | `{phone}` | Always `{retry_after_seconds}`; 429 when rate-limited |
| POST | `/api/auth/otp/verify` | public | `{phone, code}` | `{access_token, user}` + sets the refresh cookie; 401 code 102 on any failure |
| POST | `/api/auth/telegram/webapp` | public | `{init_data}` | `{access_token, user}`, no cookie; 403 code 103 `phone_required` |
| POST | `/api/auth/refresh` | refresh cookie | header `X-Requested-With: eventopia` | `{access_token}` + rotated cookie (30 s grace); 401 when there is no valid cookie |
| POST | `/api/auth/logout` | refresh cookie | header `X-Requested-With: eventopia` | `{}`; revokes the session and clears the cookie |
| GET | `/api/users/me` | user | | Profile: uid, username, names, image_url, gender, birth_date, phone (masked) |
| GET | `/api/countries/list/` | public | | As today |
| GET | `/api/categories/` | public | `?is_indoor&is_outdoor&is_online` | |
| POST | `/api/categories/` | user | JSON | |
| POST | `/api/locations/` | user | `{name, latitude, longitude, city…}` | As today |
| GET | `/api/activities/country/{csv}/` | public | `?search_by` | |
| GET | `/api/activities/state/{csv}/` | public | `?search_by&countries[]=` | |
| GET | `/api/activities/city/{csv}/` | public | `?search_by&countries[]=&states[]=` | |
| POST | `/api/activities/` | user | JSON | Creator = caller |
| GET | `/api/activities/{pk}` | public | | No trailing slash (as called today) |
| POST | `/api/activities/{pk}/join/` | user | | Idempotent |
| POST | `/api/activities/{pk}/leave/` | user | | Idempotent |
| GET | `/api/teams/country/{csv}/`, `state/{csv}/`, `city/{csv}/` | public | Same query params as activities | |
| GET | `/api/teams/search/{q}/` | public | | |
| POST | `/api/teams/` | user | multipart (fields + `image`) | Creator = caller |
| GET | `/api/teams/{name}/` | public | | Detail incl. members (no PII) |
| POST | `/api/teams/{name}/join/` | user | `{name_on_jersey, player_number, position}` | 409 on duplicate member/number |
| GET | `/api/organizations/country/{csv}/`, `state/{csv}/`, `city/{csv}/` | public | Same query params | Filters actually applied |
| GET | `/api/organizations/list/` | public | | Names for the select box |
| POST | `/api/organizations/` | user | multipart (fields + `image`) | Creator = caller |
| GET | `/api/health/live`, `/api/health/ready` | public | | `ready` checks Neo4j and SQLite |

The parked chatbot endpoint `/api/chatbot/` is **not** implemented. The frontend hides the chat entry point.
