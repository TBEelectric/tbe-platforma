# TBE platforma

Internal web app for TBE electric (electrical installation company, 10–25 employees, 6–15 vehicles).
One modular Next.js app, one PostgreSQL database, one Google login. Modules are switched from a
launcher with tiles and from the module switcher in the sidebar.

First release: **core + timesheets (docházka)**. Next: **fleet (vozový park, kniha jízd)**.
Later: properties, inventory, tools.

Read before working:
- `docs/technicky-navrh.md` – data model, rules, permissions, timesheet states, export (source of truth)
- `docs/zadani-dochazky.md` – business requirements for timesheets
- `docs/architektura.md` – platform architecture and module boundaries
- `docs/design.md` – visual style and screen list; reference screens (HTML + PNG) in `docs/design/screens/`.
  Look at the PNG of a screen before building it. They are visual references, not code to copy:
  rebuild them with shadcn/ui + Tailwind using the tokens in `docs/design.md`.
- `docs/plan.md` – milestones and the current task list

## Language

- Code, identifiers, DB tables/columns, API, commits, tests: **English**.
- UI texts, docs in `docs/`: **Czech** (with diacritics).
- Czech domain terms map to English names via the glossary in `docs/technicky-navrh.md`.
  Never invent a new term: add it to the glossary first. Key ones: zakázka = `job`,
  interval = `time_entry`, měsíční výkaz = `timesheet`, uzávěrka = `period_close`,
  parta = `team`, druh práce = `work_type`, absence = `absence`, pohotovost = `standby`.

## Stack

- TypeScript strict, one Next.js project (no monorepo; see "Repository layout")
- Next.js (App Router, server actions), React, Tailwind CSS, shadcn/ui
- PostgreSQL 16, Drizzle ORM + drizzle-kit migrations
- Better Auth with Google; only allow-listed emails can sign in
- Zod schemas shared by client and server
- TanStack Table for data tables
- Vitest for rules and calculations (Playwright added before the pilot)
- Docker Compose (local Postgres now; app + worker + db + Caddy on VPS later)
- pnpm as package manager

## Repository layout

One Next.js app. Modules are folders, not packages.

```
src/
  app/                 Next.js routes (App Router); thin pages that call module code
  modules/
    core/              employees, teams, customers, jobs, sites, holidays
      index.ts         server-side public API
      shared.ts        client-safe public API (types, Zod schemas, pure rules)
      schema.ts        Drizzle tables (Postgres schema `core`)
      rules/           pure functions + tests
      actions.ts       server actions
      components/      module UI
      permissions.ts   who can do what
      menu.ts          sidebar items
    timesheets/        same structure; Postgres schema `timesheets`
    fleet/             later
  components/ui/       shadcn/ui components in the TBE style
  lib/                 db client, auth, audit log, date/time helpers
  worker.ts            scheduled jobs (reminders, e-mails, exports), run as a separate process
drizzle/               generated migrations
docker-compose.yml     local PostgreSQL
```

Module boundaries: a module may import another module only through its public API, never its
internal files. This keeps an easy path to split modules into packages later.
- `index.ts` – server-side API (may use the database); re-exports `shared.ts`.
- `shared.ts` – client-safe API: types, constants, Zod schemas, pure rules (no database access).
  Client components import `@/modules/<module>/shared`.
- `schema.ts` may import another module's `schema.ts` directly, only for foreign keys
  (drizzle-kit loads schema files without the app's server code).

## Rules that matter

- **All business rules and calculations are pure functions** in `src/modules/<module>/rules`
  with Vitest tests. The form, the server action and the export call the same function.
- **Authorization on the server** for every action, page load and export. Never rely on hiding UI.
- **Every change** to time entries, absences, timesheets and period close writes `audit_log`
  (actor, before, after, reason). Changes on behalf of someone else and reopening require a reason.
- **No hard deletes** of business records; use `archived_at`. Deleting a time entry in an open
  month is allowed but stays in the audit log.
- **Time:** store `timestamptz`, display Europe/Prague. An entry crossing midnight belongs to the
  day it started. Handle DST.
- **Closed/confirmed months are locked** for edits (see timesheet states in `docs/technicky-navrh.md`).
- Thresholds (DPP yearly limit, night 22:00–6:00, 12 h warning…) live in `timesheet_settings`,
  not in code.
- Money/rates are not tracked yet; do not add them without asking.

## Commands

First run: `cp .env.example .env`, fill it in, then `pnpm install`, `docker compose up -d db`, `pnpm db:migrate`.

```
docker compose up -d db   # start local PostgreSQL 16 (port 5432, db/user/password: tbe)
pnpm dev                  # run web app on http://localhost:3000
pnpm worker               # run scheduled jobs locally
pnpm test                 # vitest (run once); pnpm test:watch for watch mode
pnpm lint                 # eslint
pnpm typecheck            # next typegen + tsc
pnpm format               # prettier --write (format:check in CI)
pnpm build                # production build (also type-checks)
pnpm db:generate          # drizzle-kit generate (new migration from schema changes)
pnpm db:migrate           # apply migrations
pnpm db:seed              # sample data
pnpm db:studio            # Drizzle Studio (browse the database)
```

Before each commit: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

Notes:
- Next.js 16 docs for the installed version are in `node_modules/next/dist/docs/` (see `AGENTS.md`).
  Cache Components are on: request data (`headers()`, session, `new Date()`) must sit under `<Suspense>`,
  after `await io()`, or on a route with `export const instant = false`.
- Auth: every protected page, server action and export calls `requireUser()` from `src/lib/current-user.ts`.
  Layouts do not protect pages (they render in parallel); `src/proxy.ts` is only an optimistic cookie check.
- Drizzle uses `casing: "snake_case"`: write camelCase keys in `schema.ts`, columns become snake_case.
- shadcn/ui: `pnpm dlx shadcn@latest add <component>`; then adjust sizes to the TBE style (44 px controls).

## Git

- If the folder is not a git repository yet, run `git init` (branch `main`) before the first change,
  add a `.gitignore` (node_modules, .next, .env*, except .env.example) and make an initial commit
  with the existing docs.
- **Commit after every finished task** from `docs/plan.md`, once the app builds and tests pass.
  One task = one commit. Commit message in English, imperative, short subject
  (e.g. `Add Drizzle setup and first migration`), body with what and why if useful.
- Never commit secrets: `.env` stays local; keep `.env.example` with placeholder values up to date.
- Do not push, create remotes or rewrite history (rebase, force push, reset of committed work)
  unless the user asks.

## Working style

- Small, reviewable steps. Follow `docs/plan.md`; tick tasks when done (in the same commit).
- Write tests for rules first (overlaps, breaks, night/weekend/holiday split, monthly sums).
- If a requirement is unclear or contradicts the docs, stop and ask instead of guessing.
- UI must work on a phone (field workers use the PWA) – touch targets ≥ 44 px.
- Use the latest stable versions of the libraries and check their current docs; APIs of Next.js,
  Better Auth and Drizzle change often.
