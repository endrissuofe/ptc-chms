# PTC Chapel — Church Management System

Attendance, first-timer cards, follow-up and prayer — in one place for the RCCG Peculiar
Treasure Chapel team. A private staff app: everyone signs in.

What it does:

- **Ushers:** record the door count per service and type up first-timer cards on a phone;
  returning visitors are recognised by phone number.
- **Follow-up team:** a shared call list with Call and WhatsApp buttons, home addresses for
  visits, and a call log; a 7 AM email of new first timers and anyone waiting over 72 hours.
- **Prayer team, pastors and admins:** prayer requests from the cards.
- **Pastors and admins:** dashboard, first-timers table (export, move to Members), services.
- **Media team:** birthdays and wedding anniversaries, with a line ready for the socials.
- **Admins:** SMS (instant thank-you and welcome back, Saturday invite, birthday wishes,
  broadcasts to members), the member list (CSV import), email alerts and logins.
- **Joining:** each team has an invite link; people sign up themselves and an admin approves
  them. Everyone manages their own details and emails on My account.

## What you need on your computer

- **Node.js 22** (LTS) — https://nodejs.org
- **Docker Desktop** with WSL 2 turned on — https://www.docker.com/products/docker-desktop
- **Git** — https://git-scm.com

## First-time setup (Windows, PowerShell)

```powershell
cd C:\Users\ptcha\Documents\ptc-chms
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

- `src/app` — screens (grouped by role) and API routes
- `src/services` — business rules, each with tests in `tests/`
- `src/lib` — shared helpers (phones, dates, stages, SMS providers, roles)
- `src/components` — the app frame and shared UI parts

Architecture notes, the design system and the operating runbook are kept with the
project maintainers rather than in this repository.

## Rules of the road

- Never commit `.env` or real phone numbers.
- Tests and local development always use `SMS_PROVIDER=mock`; only the live site sends real SMS.
- Every change goes through a branch and a pull request; CI must be green before merging.
