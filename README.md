# PTC Chapel — Church Management System

Attendance, first-timer tracking and follow-up for RCCG Peculiar Treasure Chapel.
Phase 1 covers door headcount, first-timer cards, returning visitors, follow-up calls,
prayer requests (pastors only) and automatic SMS.

## What you need on your computer

- **Node.js 22** (LTS) — https://nodejs.org
- **Docker Desktop** with WSL 2 turned on — https://www.docker.com/products/docker-desktop
- **Git** — https://git-scm.com

## First-time setup (Windows, PowerShell)

```powershell
cd C:\Users\ptcha\Documents\ptc-chms
git init -b main                # start version control (needed for the pre-commit hook)
copy .env.example .env          # then open .env and change every "change-me" value
npm install                     # installs dependencies and the git pre-commit hook
docker compose up -d mongo mongo-express
npm run migrate                 # creates database indexes
npm run seed                    # test users and sample newcomers (development only)
npm run dev
```

Open http://localhost:3000 and sign in with one of the test users listed at the top of
`scripts/seed.mjs`. Browse the database at http://localhost:8081.

To run the whole stack (app included) in Docker instead: `docker compose up --build`.

## Everyday commands

| Command                                           | What it does                                                 |
| ------------------------------------------------- | ------------------------------------------------------------ |
| `npm run dev`                                     | Start the app with hot reload                                |
| `npm test`                                        | Unit and service tests (uses a throwaway in-memory database) |
| `npm run test:e2e`                                | Browser tests against a running app                          |
| `npm run lint` / `npm run format`                 | Check and tidy code                                          |
| `npm run db:up` / `npm run db:down`               | Start / stop MongoDB and Mongo Express                       |
| `docker compose --profile backup run --rm backup` | Back up the database now                                     |

## How the project is laid out

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Operating tasks (backups, restores,
SMS go-live, deployment) are in [docs/RUNBOOK.md](docs/RUNBOOK.md). The approved screen
designs are in `docs/design/` and the design rules in `docs/DESIGN.md`.

## Rules of the road

- Never commit `.env` or real phone numbers.
- SMS stays on `SMS_PROVIDER=mock` until the sender ID is approved and the church signs off.
- Every change goes through a branch and a pull request; CI must be green before merging.
