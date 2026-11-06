# Eventopia revival: getting-started analysis

_2026-11-07. Covers the `activities` repo at `dev` (a55651f), the home server `roma`, and the current versions of every dependency. It doesn't propose any code yet. Its job is to put the decisions in front of us._

---

## 1. Where the code lives

| Repo | Last push | Status |
|---|---|---|
| `khajiev13/activities` **`dev`** | 2025-02-08 | **Newest code.** 9 commits ahead of `main` (teams/activities service refactor, DeepSeek chatbot, Docker tweaks) |
| `khajiev13/activities` `main` | 2025-01-07 | Behind `dev`. Needs `dev` merged in |
| `khajiev13/activities-frontend` | 2025-01-09 | Older copy of `frontend/`. Everything in it is in `activities@dev`, newer. Safe to archive. Its `gh-pages` branch served **eventopia.live** (last deploy Nov 2024) |
| `khajiev13/eventopia-backend` (private) | 2024-09-30 | Older copy of `backend/` with the Azure App Service setup. Safe to archive |

There are no other local copies on this laptop. The clone at `~/activities` is on `dev`.

## 2. What the app is

Eventopia is a social platform for sports activities, teams, organizations and leagues, seeded with real data from Beijing amateur football leagues.

```
React 18 + Vite SPA ──HTTP/JSON──► Django 5 + DRF ──bolt──► Neo4j (Aura cloud)
 (MapTiler maps, shadcn)           (neomodel OGM,          17 node labels:
                                    SimpleJWT, SQLite       USER, TEAM, ACTIVITY,
                                    for token blacklist)    ORGANIZATION, LOCATION,
                                          │                 CITY/STATE/COUNTRY,
                                          ├──► Azure Blob   CATEGORY, LEAGUE, …
                                          │    (stubbed out)
                                          └──► DeepSeek LLM via LangChain
                                               GraphCypherQAChain ("ask the graph")
```

- **Backend:** about 2,600 lines of views, serializers, URLs, services and Cypher, plus 540 lines of models. There are 15 Django apps, and 7 of them have models but no routes (leagues, competitions, achievements, …).
  - Django's ORM, admin and model serializers are **not used**. Everything is neomodel nodes and hand-written Cypher.
- **Frontend:** 150 modules. Pages: login, register, activities (list, map, create), teams (list, detail, create), organizations, map, chatbot.
  - Every backend endpoint the frontend calls exists.
- **Seed data:** `backend/core/data/` has 48 teams and 1,065 players, plus fixtures and results that nothing loads yet.
  - `core/functionss.py` seeds Neo4j, run by hand through `manage.py shell`.

## 3. Current health

Short version: **the code needs fixing before it can be deployed anywhere.** Several core endpoints already fail on `dev`.

### Backend (worst first)
1. **Logging middleware** (`core/middleware.py`) re-wraps `db.cypher_query` on every request. After about 1,000 requests per worker, every query raises RecursionError.
2. **Wide-open auth.**
   - The default permission is `AllowAny`.
   - Anyone can PATCH any user's password (`users/views.py` `UserDetailView`).
   - The user list leaks emails and birthdates.
   - Activities, colors, categories, locations and organizations can all be written anonymously.
   - Access tokens last 20 days and stay valid after logout.
3. **Production settings.** `DEBUG` is forced to True, `ALLOWED_HOSTS` is hardcoded, and `print(config.DATABASE_URL)` logs the Neo4j password.
4. **Activity create** passes a serializer instead of its data, so it returns 201 with an empty body and saves nothing.
5. **Plain team and activity lists return 500** because `teams` is used before it's set.
6. **Team create, update and delete are broken.** Causes: no serializer class, an unbound service call, and `get_object` returning a dict.
7. **Storage is stubbed out.** `create_image` and `delete_picture` just `pass`. Every DELETE (users, teams, orgs) returns 500, and the org create stores the literal string `"file_url"`.
8. **Models and Cypher disagree on relationship names** (e.g. `BASED_IN` vs `CITY_BASED_IN`, `HAS` vs `HAS_TEAM` vs `BELONGS_TO`). Two `cardinality=One` declarations are wrong and will fail under neomodel 7's strict checks.
9. **The chatbot always returns 500.** `chain.run()` fails when `return_intermediate_steps=True`, and the LLM-generated Cypher runs with write access.
10. **No tests.** All 18 `tests.py` files are empty stubs.

### Frontend
1. **`yarn build` fails** with 23 TypeScript errors. 22 of them come from `@types/react` 19 being installed with React 18.
2. **The API URL is hardcoded** to `http://127.0.0.1:8000/`. No env var is read.
3. **Token refresh never fires behind HTTP/2**, because it checks `statusText === 'Unauthorized'`. There's no single-flight refresh lock and no protected routes.
4. **Next.js code inside a Vite app:** `next/link`, `next/image`, `next/dynamic` and a pasted Next chat app.
5. **Broken flows:**
   - The team drawer probably crashes on open (`NewTeamDrawer.tsx:232`).
   - The Join Team button opens a demo dialog.
   - The activity detail page shows mock data.
   - The Outdoors and Indoors nav links lead to a 404.
6. **Deployment pieces:** the Dockerfile runs `yarn dev`, public sourcemaps are switched on (about 13 MB), the main JS bundle is 2.9 MB and there's a 4.3 MB PNG.
7. **Every major dependency is a version or more behind:** React 19, Router 7, Vite 8, Tailwind 4, zod 4, MapTiler SDK 4, motion 14.

## 4. Leaked credentials (rotate them regardless of the plan)

The repo is **public**, and these are in its git history:

| What | Where | Action |
|---|---|---|
| Neo4j Aura password | `backend/core/settings.py` comment (both branches) | Delete the Aura instance or rotate the password |
| GCP service-account private key (`peerless-list-327509`) | `backend/credentials_google.json` (tracked, though gitignored) | **Revoke the key in GCP IAM** |
| DeepSeek API key | commit `d46c9b3` (`chatbot/views.py`) | Revoke it in the DeepSeek console |
| MapTiler API key | `frontend/src/components/Map/BaseMap.tsx:19` | Rotate it and restrict allowed origins |
| GeoNames username | `AddLocation.ts:51` | Low risk. Move it to env |

Rotating is what actually protects us. Rewriting history (`git filter-repo`) is optional cleanup: forks and caches keep the old commits anyway.

## 5. The home server (`home` → `roma`, via Tailscale 100.83.253.36)

| | |
|---|---|
| OS | Ubuntu 22.04.5, kernel 6.8, amd64, headless (multi-user target) |
| CPU and RAM | i5-7200U, 2 cores / 4 threads · **5.7 GiB RAM** + 2 GiB swap |
| Disk | `/` ext4 67 GB, **17 GB free** · `/mnt/storage` 450 GB is **NTFS (fuseblk), mounted read-only**, so it can't hold Docker data |
| Docker | 28.1.1 + Compose 2.35.1 installed but **masked and disabled** (by `~/disable-home-workloads.sh`, 2026-09-13). User `khajiev13` is already in the `docker` group |
| Network | Tailscale up · no public ports · earlier apps used **Caddy + Cloudflare Tunnel**, the same pattern we'd use here |
| sudo | Needs a password, so the root steps are yours to run (listed below) |
| Old workloads | `~/apps/restaurant-mini-app` (was cut over in July), `~/apps/lab_4_professor_agent_app`, their images and volumes in `/var/lib/docker` (size unknown without root), `.migration-backup-restaurant/` dumps |

**Space we can reclaim (about 12–15 GB plus old Docker data):**
- systemd journal: 4.0 GB
- disabled snap revisions and unused desktop snaps: part of the 7 GB in `/var/lib/snapd`
- apt cache: 2 GB
- `~/.cache`: 4 GB
- `~/.npm`: 2.3 GB
- `~/node_modules`: 331 MB

**Memory budget for the new stack:**

| Service | Limit | Notes |
|---|---|---|
| Neo4j 2026.10 | 1.5 GB | heap 512m (initial = max) + pagecache 384m + transaction cap 256m |
| Object store (Silo) | 1 GB | Typically 200–500 MB; `GOMEMLIMIT=600MiB` |
| API (FastAPI or Django) | ~400 MB | 2 workers |
| Caddy + cloudflared | ~100 MB | |
| OS and headroom | ~2.5 GB | Enough room for one-off jobs (seeding, backups) |

## 6. Technology decisions

### 6.1 Backend framework: **FastAPI (decided 2026-11-07)**
- **Architecture guide:** the `python-service-patterns` skill (`~/.claude/skills/python-service-patterns`).
  - Layers: views → services → data access, with constructor dependency injection and one service per domain.
  - For Neo4j, the skill's `sqls/` layer becomes a Cypher repository layer.
  - Two places where the skill conflicts with this project, to settle in the design doc:
    - Its `{requestId, error, data}` response envelope would change the JSON shapes the frontend expects.
    - It recommends YAML config, while Docker deployments usually use env vars / pydantic-settings.

- **Against staying on Django:**
  - Django's selling points (ORM, admin, migrations) are unused here.
  - The only Neo4j bridge, `django-neomodel`, is dead. It pins neomodel 5.3, and its Django 6 PR was closed unmerged on 2026-11-06.
  - SQLite exists only for the JWT blacklist.
- **For FastAPI:**
  - `dev` already moved toward a services and repository layer.
  - The seed code already uses Pydantic.
  - It matches the user's recent projects (cargo bot, restaurant app, BIT agent) and their Caddy + tunnel deploy pattern.
  - Async and streaming suit the LLM chatbot.
- **Plan:**
  - neomodel 7 for node classes, constraints and simple CRUD.
  - Hand-written Cypher in repository modules for graph queries.
  - Pydantic for request and response schemas.
  - Keep the URL paths and JSON shapes the frontend uses, and fix behaviour and permissions behind them.
  - Refresh-token revocation lives in Neo4j, so there's no SQLite.
- **Cost:** porting about 2,600 lines of API layer. Roughly 500 lines of Cypher carry over almost as-is.

### 6.2 Graph database: **Neo4j Community `2026.10.1-community-trixie`**
- **Version choice:** calendar releases get fixes only until the next monthly release, so we upgrade monthly. The other option is `5.26.32` LTS (supported until 2028-06), frozen and patch-only. For a new deployment, calendar releases are recommended.
- **Cypher 25:** new databases default to `CYPHER_25`. The current Cypher only has two deprecated `ID()` calls, both in dead code.
- **APOC:** use `NEO4J_PLUGINS='["apoc"]'`, which takes the copy bundled in the image, so versions always match. LangChain's `Neo4jGraph` needs `apoc.meta.data`. Replace `apoc.create.uuid()` with `randomUUID()`.
- **Backups (Community):** `neo4j-admin database dump` works **only while the database is offline**. So:
  - nightly online `apoc.export.cypher.all`
  - weekly stop, dump, start
- **Data:** the old Aura instance's data is assumed lost or not worth migrating. We rebuild from the seed files.

### 6.3 Object storage: **"MinIO" means the Silo fork now** (open question)
- **Upstream MinIO is gone:**
  - `minio/minio` was archived in April 2026 (last release 2025-10-15).
  - Official images stopped in October 2025.
  - The images were pulled from Docker Hub around September 2026.
- **Silo** (`pgsty/silo:RELEASE.2026-10-26T00-00-00Z`) is the maintained MinIO fork, formerly `pgsty/minio`:
  - same binary lineage, `MINIO_*` env vars and `mc` workflow
  - the full web console is back
  - 9 releases in 2026 with CVE fixes
  - risk: one small maintainer team
  - **Recommended.**
- **Garage v2.5.0** is the runner-up:
  - lightest (about 40–100 MB idle), stable, run by a non-profit
  - no bucket policies, so public files need a separate website-mode bucket
  - its web UI is a pre-release
- **Avoid:**
  - RustFS 1.0.4: 7 weeks after GA, about 43 security advisories in 2026, and an open memory-growth bug on single-drive setups.
  - SeaweedFS: overkill for this.
- **Public images:** a `media` bucket with anonymous download on the `public/` prefix, served by Caddy at `/media/public/*`. Presigned URLs for anything private.
- **Gotcha:** boto3 1.36 and later send CRC32 checksums by default. Set `AWS_REQUEST_CHECKSUM_CALCULATION=when_required` and `AWS_RESPONSE_CHECKSUM_VALIDATION=when_required`.
- **Escape hatch:** everything is S3, so `rclone sync` can move the data to any other store later.

### 6.4 Chatbot
- `langchain-neo4j 0.11.0`: `from langchain_neo4j import GraphCypherQAChain, Neo4jGraph`, `allow_dangerous_requests=True`, `.invoke()` instead of `.run()`.
- `langchain-deepseek 1.1.1` (`ChatDeepSeek`) instead of `ChatOpenAI` with a `base_url`.
- Community edition has no role-based access, so we can't make a read-only DB user. We have to guard the generated Cypher in code instead: reject write clauses, and use a read transaction.
- Long LLM calls hit limits: Cloudflare cuts responses at 125 s, and Caddy has 1-minute idle timeouts. Stream responses, or cap them at about 60 s.

### 6.5 Verified latest versions (2026-11-07)

| Component | Version | Note |
|---|---|---|
| neo4j image | `2026.10.1-community-trixie` | 2026.10.2 is tagged on GitHub but not on Docker Hub yet |
| neomodel | 7.0.0 | Pins the **neo4j driver to `~=6.1.0`** (6.4.1 can't be used) |
| neo4j (Python driver) | 6.1.0 | Forced by neomodel |
| FastAPI / uvicorn | 0.162.0 / 0.54.0 | If we go with FastAPI |
| pydantic-settings / PyJWT / pwdlib | 2.16.2 / 2.15.1 / 0.3.1 | Config, JWT, password hashing |
| _or_ Django / DRF / simplejwt | 6.1.3 / 3.18.3 / 5.5.1 | If we stay on Django. simplejwt doesn't declare Django 6.1 support |
| langchain / langchain-neo4j / langchain-deepseek | 1.4.9 / 0.11.0 / 1.1.1 | |
| boto3 | 1.43.x | Needs the checksum env vars |
| Python base image | 3.13-slim-trixie | Every package supports 3.13 |
| Silo (MinIO fork) | `RELEASE.2026-10-26T00-00-00Z` | |
| Caddy | 2.11.9-alpine | 2.11.6+ has 1-minute idle timeouts and drops headers containing `_` or `.` |
| cloudflared | 2026.10.7 | Distroless image; health check with `cloudflared tunnel ready` |
| Node (frontend build) | 22 LTS | Vite 8 needs Node ≥ 20.19 |

## 7. Target deployment

```
Internet ──► Cloudflare (eventopia.live?) ──tunnel──► cloudflared ──► Caddy :80
                                                                      ├─ /api/*          ► api:8000   (FastAPI)
                                                                      ├─ /media/public/* ► silo:9000  (anonymous GET)
                                                                      └─ /*              ► /srv SPA (try_files → index.html)
api ──bolt──► neo4j:7687        api ──S3──► silo:9000        api ──https──► DeepSeek
Admin access (Neo4j Browser :7474, Silo console :9001) only through Tailscale, never public.
```

- One `docker compose` project in `~/apps/eventopia`.
- Secrets live in `.env` (mode 600) and are never committed.
- Everything binds to the internal network or `127.0.0.1`; only cloudflared talks to the outside.

## 8. Proposed roadmap

**Phase 0: Hygiene** (no server needed)
- Rotate the 4 leaked credentials.
- Merge `dev` into `main`.
- Archive `activities-frontend` and `eventopia-backend`.
- Delete junk files: `10.8.3`, `frontend@0.0.0`, root `requirements.txt` and `Procfile`, the Azure workflow, `core/production.py`, `credentials_google.json`.

**Phase 1: Server prep** (you run the sudo steps)
- Unmask and enable Docker.
- Vacuum the journal, clean apt, remove old snap revisions and desktop snaps.
- Decide what to do with the old restaurant and lab4 images and volumes (see the questions below).
- Docker data stays on `/` (ext4), since the NTFS disk is read-only.

**Phase 2: Local dev stack**
- `compose.dev.yml` with Neo4j, Silo, the API (hot reload) and Vite (with an `/api` proxy).
- A repeatable seed command.
- Fix the seed bugs: usernames collide, passwords are guessable, women's teams are seeded as men's teams.
- The rosters contain real people's names and birthdates. Decide whether to anonymise them.

**Phase 3: Backend port**
- Write contract tests from the endpoint inventory first, then port one domain at a time:
  - auth and users
  - teams
  - activities
  - organizations, locations, categories, countries, states
  - media
  - chatbot
- Fix permissions as each one is ported.

**Phase 4: Frontend to deployable**
- API base URL from env.
- Get the build passing.
- Fix auth refresh and add route guards.
- MapTiler key from env.
- Remove the Next.js leftovers.
- Fix the broken flows.
- Multi-stage Docker image with no sourcemaps.

**Phase 5: Deploy**
- Production compose with Caddy and cloudflared.
- Point DNS at the tunnel.
- Backups: nightly APOC export, weekly offline dump, Silo mirrored with `mcli mirror`.
- Health checks and restart policies.

**Phase 6: Upgrades and features**
- Upgrade the frontend's major dependencies in stages: React 19, Router 7, Vite 8, Tailwind 4.
- Wire up leagues, competitions and fixtures (the data is already in the repo).

## 9. Open decisions

1. ~~**Backend:** FastAPI or Django?~~ **FastAPI, using `python-service-patterns`.**
2. **Object storage:** Silo, the MinIO fork (recommended), or Garage?
3. **Domain:** do you still own **eventopia.live**, and is it on Cloudflare? Otherwise, which hostname?
4. **Server cleanup:** is `restaurant-mini-app` live somewhere else now, so its Docker volumes on `roma` can go? Can `lab_4_professor_agent_app` go?
5. **Chatbot:** keep it with DeepSeek (needs a new key), or park it until the core works?
6. **Seed data:** use the real Beijing league rosters as they are, anonymise them, or use synthetic data?

## Sources
- Neo4j Docker configuration: https://neo4j.com/docs/operations-manual/current/docker/configuration/
- Neo4j offline backup (Community): https://neo4j.com/docs/operations-manual/current/backup-restore/offline-backup/
- APOC installation and version matching: https://neo4j.com/docs/apoc/current/installation/
- Cypher 25 deprecations: https://neo4j.com/docs/cypher-manual/25/deprecations-additions-removals-compatibility/
- neomodel releases and config: https://github.com/neo4j-contrib/neomodel/releases · https://neomodel.readthedocs.io/en/latest/configuration.html
- Django 6.0 and 6.1 release notes: https://docs.djangoproject.com/en/6.1/releases/6.0/ · https://docs.djangoproject.com/en/6.1/releases/6.1/
- django-storages S3: https://django-storages.readthedocs.io/en/latest/backends/amazon-S3.html
- boto3 data-integrity defaults: https://docs.aws.amazon.com/sdkref/latest/guide/feature-dataintegrity.html
- MinIO archival coverage: https://vegardit.com/en/blog/minio-alternatives/ · https://www.stablebuild.com/blog/minio-images-disappeared-from-docker-hub · https://bex.co/blog/2026/09/25/minio-docker-hub-removal-quay-repoint
- Silo (MinIO fork): https://github.com/pgsty/silo · https://silo.pgsty.com/about/security-advisories/
- Garage: https://garagehq.deuxfleurs.fr/documentation/quick-start/
- RustFS 1.0 GA and advisories: https://rustfs.com/blog/announcing-rustfs-1-0-0-ga/ · https://github.com/rustfs/rustfs/security/advisories
- LangChain v1 migration and ChatOpenAI: https://docs.langchain.com/oss/python/migrate/langchain-v1 · https://docs.langchain.com/oss/python/integrations/chat/openai
- Caddy patterns and options: https://caddyserver.com/docs/caddyfile/patterns · https://caddyserver.com/docs/caddyfile/options
- Cloudflare connection limits: https://developers.cloudflare.com/fundamentals/reference/connection-limits/
