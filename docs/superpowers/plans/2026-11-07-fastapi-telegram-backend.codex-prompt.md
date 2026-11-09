You are implementing an approved plan in the repository at /Users/khajievroma/activities. You are on the git branch `feat/fastapi-telegram`.

## Read these first, fully, in this order
1. **The design spec:** `docs/superpowers/specs/2026-11-07-fastapi-telegram-backend-design.md`. It describes what to build and why.
2. **The plan:** `docs/superpowers/plans/2026-11-07-fastapi-telegram-backend.md`. It has 21 tasks, and you execute it exactly.
3. **The architecture skill the backend must follow:** `/Users/khajievroma/.agents/skills/python-service-patterns/SKILL.md`, plus its `references/code-style.md` and `references/integrations.md`.

The plan's "Global Constraints" section applies to every task.

## Preflight (do this before Task 1; stop and ask me if anything fails)
- `git status` is clean, and `git branch --show-current` prints `feat/fastapi-telegram`.
- `docker info` works. Testcontainers and the dev stack need it. **If Docker is missing or not running, STOP and tell me.** Don't install anything system-wide yourself.
- `uv self update`, then `uv --version`. `node --version` and `yarn --version` work.
- The repo-root file `config-local-dev.yaml` exists. It holds the Telegram bot token. It is git-ignored, and Task 1 moves it to `api/config-local-dev.yaml`.

## How to work
- **Order:** do the tasks in order, 1 → 21, and do every step in each task in order. TDD is mandatory:
  1. write the failing test
  2. run it and confirm it fails for the expected reason
  3. implement the minimum
  4. run it and confirm it passes
  5. run the task's whole test file plus `uv run ruff check .`
  6. commit
- **Commits:** after each task, tick its checkboxes (`- [x]`) in the plan file and commit them along with the code, using the task's commit message. Commit only that task's files. Never amend earlier commits, never rewrite history, and never push.
- **Versions:** use the exact versions in the plan's Tech Stack. In Task 1, check PyPI for newer stable releases. If you upgrade one, say so in that commit's body.
- **When the plan doesn't match reality** (for example, a library API changed or an image tag doesn't exist): choose the smallest change that stays faithful to the spec. Add a line `Deviation: <what and why>` to that task's commit body, and keep going. Never change the spec. If a deviation would change behaviour the spec defines, stop and ask me.

## Secrets (strict)
- Never print, log, echo, paste into chat, or commit the bot token, JWT secret, OTP pepper, S3 keys, Neo4j password, OTP codes, refresh tokens or `init_data`.
- `api/config*.yaml` (except `config.example.yaml`) and `.env.dev` must stay git-ignored. Check `git status` before every commit.

## Steps that need me (a real phone with Telegram)
At these points, stop and give me short exact instructions. Wait until I reply with the result:
- **Task 9, Step 4:** `/start` and contact sharing with @eventopiarobot.
- **Task 18, Step 4:** website OTP login.
- **Task 20, Step 4:** the manual walkthrough of the core flows.
- **Task 21, Step 2:** the end-to-end check.

Only one process may poll the bot token at a time. Make sure no other `bot_main.py` or `bot` container is running before you start one.

## Checkpoints
Stop and report after **Task 8** (auth complete), **Task 16** (backend complete) and **Task 21** (done). Wait for my "continue" after the first two.

Each report contains:
- the tasks completed, with their commit hashes
- the exact test commands you ran and their pass/fail counts
- every deviation
- anything you're unsure about

## Out of scope
- No deployment.
- No access to the home server (`ssh home`).
- No changes to `docs/superpowers/specs/`.
- No frontend major-version upgrades.
- No new features beyond the plan.
