# Eventopia

Eventopia is a sports community app for organizations, teams, activities and
competitions, with geographic search and maps. The web app uses React,
TypeScript and Vite. A Python 3.13 FastAPI API and a Telegram long-polling bot
share the backend services.

## Architecture

- `frontend/`: React UI, Zod validation, Tailwind/shadcn components and MapTiler
  maps. Vite proxies `/api` to FastAPI and `/media` to local object storage.
- `api/`: the `eventopia` Python package, managed by uv. HTTP views call
  framework-independent services; data access lives in `cyphers/` and `sqls/`.
  `wiring.py` constructs the dependencies used by the API and bot.
- Neo4j stores profiles, organizations, teams, memberships, activities,
  competitions and geographic data. Queries use Cypher 25.
- SQLite stores accounts, Telegram identities, hashed OTP challenges, refresh
  sessions and the bot polling offset. API and bot share its `auth-data` volume.
- Silo provides S3-compatible image storage. The one-shot `silo-init` service
  creates the media bucket and app user, with public downloads under
  `media/public`.

The browser keeps its short-lived access token in memory. Website login uses a
rotating HttpOnly refresh cookie; auth credentials do not go in browser local or
session storage. Telegram delivers website login codes after phone registration.

The API and bot are separate processes built from `api/Dockerfile`. The
entrypoint applies SQLite migrations and Neo4j constraints before starting each
process. Configuration is loaded once at startup from the YAML selected by
`EVENTOPIA_CONFIG`.

## Run locally

Use Docker with Compose v2. For host-side checks, install Python 3.13, uv, Node.js
22 and Yarn Classic. Run the following commands from the repository root.

### Configure

```sh
cp .env.dev.example .env.dev
cp api/config.example.yaml api/config-dev.yaml
cp frontend/.env.example frontend/.env.local
chmod 600 .env.dev api/config-dev.yaml frontend/.env.local
```

Fill these private files before starting the stack:

1. In `.env.dev`, set `APP_UID` to the output of `id -u`. Choose the Neo4j
   password, Silo administrator credentials and S3 app credentials.
2. In `api/config-dev.yaml`, match the Neo4j password and S3 app credentials to
   `.env.dev`. Use these container addresses and paths:
   - `neo4j.uri`: `bolt://neo4j:7687`
   - `s3.endpoint_url`: `http://silo:9000`
   - `sqlite.path`: `/data/auth/eventopia.sqlite3`
   - `app.public_base_url`: `http://localhost:5173`
   - `app.cors_origins`: include `http://localhost:5173`
   - `auth.cookie_secure`: `false` for local HTTP
3. Set the Telegram bot token and bot username, plus independently generated JWT
   secret and OTP pepper, in that YAML. Keep the example's auth limits and other
   required configuration keys.
4. Set `VITE_MAPTILER_KEY` in `frontend/.env.local`; keep
   `VITE_API_BASE_URL=/`. Frontend `VITE_` values are included in the browser
   bundle, so use only a public MapTiler browser key there.

Private configuration is git-ignored. Commit only the example files. Before
starting Compose, stop any host or other container poller using the same Telegram
bot token: exactly one bot poller may run.

### Start and seed

Use the `eventopia-task2` project name consistently so subsequent commands use
the same development volumes:

```sh
docker compose --project-name eventopia-task2 --env-file .env.dev -f compose.dev.yml up -d --build
docker compose --project-name eventopia-task2 --env-file .env.dev -f compose.dev.yml exec api python -m eventopia.seed
docker compose --project-name eventopia-task2 --env-file .env.dev -f compose.dev.yml ps --all
```

Open [localhost:5173](http://localhost:5173). The stack includes `api`, `bot`,
`web`, `neo4j`, `silo` and the one-shot `silo-init` service. All published ports
bind to localhost: web 5173, API 8000, Neo4j 7474/7687 and Silo 9000/9001.
`api`, `web`, `neo4j` and `silo` should become healthy; `silo-init` should exit 0.
The first web start installs its dependencies and can take longer.

The seed is safe to rerun. A fresh seed creates 48 teams, 943 player profiles,
1,064 memberships, 3 leagues and 4 pitches. It does not create phone login
accounts. Existing data and user-created records are preserved by reseeding.

Check the API through the web proxy:

```sh
curl -fsS http://localhost:5173/api/health/ready
curl -fsS http://localhost:5173/api/teams/search/Rockets/
```

Readiness returns `error: 0` and `data: {neo4j: true, sqlite: true}`. Search
includes Beijing Rockets and Beijing Rockets 7s.

Python dependencies are installed with `uv sync --frozen` inside `/opt/venv`;
web dependencies use `yarn install --frozen-lockfile` in `web-node-modules`.
These stay separate from host `.venv` and `node_modules`. The Neo4j, Silo and
shared SQLite data use persistent named volumes.

### Register and log in

1. Open the configured Telegram bot in a private chat and send `/start`.
2. Use its **Share my phone number** button to share your own contact. The bot
   registers your phone and links your Telegram identity to your profile.
3. Open [the website login](http://localhost:5173/login), enter that phone number
   and request a code. Enter the six-digit code received privately in Telegram.

The bot supports Uzbek, Russian and English. `/start` shows registration status;
`/phone` lets you share a replacement number. Keep the bot unblocked so it can
send login codes. The backend also verifies Telegram Mini App authentication;
the Mini App UI and BotFather setup are separate work.

The bot saves its `getUpdates` offset in shared SQLite. To check restart behavior:

```sh
docker compose --project-name eventopia-task2 --env-file .env.dev -f compose.dev.yml restart bot
```

Send `/start` once afterward and verify one reply with no replay of earlier
updates. Do not run a second host bot alongside the Compose bot.

### Stop or reset

Stop the stack while preserving data:

```sh
docker compose --project-name eventopia-task2 --env-file .env.dev -f compose.dev.yml stop
```

For a clean development reset, the following removes this project's volumes,
including uploaded images, accounts and bot offset. Register again after seeding:

```sh
docker compose --project-name eventopia-task2 --env-file .env.dev -f compose.dev.yml down -v
docker compose --project-name eventopia-task2 --env-file .env.dev -f compose.dev.yml up -d --build
docker compose --project-name eventopia-task2 --env-file .env.dev -f compose.dev.yml exec api python -m eventopia.seed
```

Before moving an existing signup database into `auth-data`, stop its writers,
take a consistent SQLite backup and preserve it before restarting API and bot.

## Checks

The API suite includes integration tests that start isolated Docker containers;
keep Docker available. It does not clear the development Neo4j database.

```sh
cd api
uv sync --frozen
uv run pytest -m "integration or not integration" -q
uv run ruff check .
cd ../frontend
yarn install --frozen-lockfile
yarn test
yarn build
```

A passing build does not replace a real-phone registration and OTP login check,
or the signed-in organization/team/image, membership, activity, competition and
geographic search flows.

See the [backend design](docs/superpowers/specs/2026-11-07-fastapi-telegram-backend-design.md)
for the API contract and data model.
