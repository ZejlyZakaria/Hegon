# HEGON — Agent handbook

> Read this file entirely before doing anything, then `hq/session-protocol.md` (what to load,
> what to update), then `hq/now.md` (where we are) and `hq/roadmap.md` (what comes next).
> Everything here is TRUE as of 2026-09-17. If the code disagrees with this file, the code wins
> — and this file gets fixed in the same commit.

---

## 1. What HEGON is

- **Personal digital second brain** for one person (Zakaria) — one app for all of life: tasks,
  watching (films / series / anime), sports, habits, goals, journal, books; more later.
- **Stack**: Next.js 16 (App Router) · React 19 · TypeScript strict · Supabase (Postgres, Auth, edge
  functions, pg_cron) · TanStack Query v5 · Zustand (UI state only) · Tailwind CSS v4 · Framer
  Motion · Vitest · Playwright. Deployed on Vercel, `hegon.fr` behind Cloudflare.
- **Doctrine**: *cron → table → app*. The browser never talks to a third-party provider during a
  render; robots (edge functions on pg_cron) write tables, the app reads them.
- Explicitly excluded, permanently: Redux/MobX · global Zod runtime · tRPC · CSS-in-JS · custom
  Service Worker.

## 2. Architecture — modular monolith

```
src/
├── app/                      ← Next.js App Router: THIN pages only (auth + data seed + one client)
│   └── (main)/               ← shell: Dock (nav) + TopBar + <main>; dashboard/, perso/watching/,
│                                perso/sports/{football,tennis,f1}/, pro/tasks/, life/{...}
├── modules/{module}/         ← ALL business logic
│   ├── service.ts            ← every Supabase / TMDB query (never inline in a component or hook)
│   ├── types.ts
│   ├── hooks/query-keys.ts   ← TanStack key factories (`as const`); hooks/use*.ts call the service
│   ├── lib/                  ← pure, tested logic (Watching: watch-status, series-state, media-view…)
│   └── components/
├── shared/                   ← ui primitives (shared/components/ui = the design system AS CODE),
│                                navigation/Dock.tsx (THE nav, owns SECTION_COLORS), hooks, utils
└── infrastructure/supabase/  ← client.ts (browser) · server.ts (server)
supabase/
├── migrations/               ← versioned, applied with `npx supabase db push --linked` (never the SQL editor)
├── functions/                ← Deno edge functions = the robots (watching-*, for-you-refresh, football_*, tennis_*, f1_*)
└── checks/                   ← watchdog SQL (job-health, job-freshness, schema-drift) + expected-objects.json
hq/                           ← the "headquarters": rules, decisions, backlogs, audit plan (its own git repo)
```

Rules that follow from the shape:
- Server pages fetch with `createServerClient()` + React `cache()`; interactive UI is `"use client"`
  with TanStack Query hooks calling `service.ts`. `Promise.all` for parallel fetches.
- Mutations invalidate their keys on success. Optimistic updates only when the cache key is
  guaranteed to exist. Every reference-data query declares `staleTime` **and** `gcTime` (`STALE.*`).
- No N+1: never a hook per card, never a request per item — batch reads (`scripts/list-requests.mjs`
  lists what a page requests; `measure-cache.mjs` counts). A legitimate pagination loop carries an
  `eslint-disable-next-line no-restricted-syntax` with the reason.
- PostgREST caps a response at **1 000 rows**: page by `Range` when a read can exceed it.

## 3. Modules — status (2026-09-17)

| Module | Where | Status |
|---|---|---|
| **Watching** | `modules/watching` (schema `watching`) | **Audited, unfrozen, v4 shipped** (see `hq/modules/watching/`). The reference implementation for everything: service layer, lens (`buildMediaView`), one status writer, marks grammar, robots, Museum, People. |
| Sport (football, tennis, f1) | `modules/sports/*` (schema `sport`) | **Frozen** until its phase-3 audit. Server-side `createServerClient()` + `cache()`. |
| Dashboard OS | `modules/dashboard-os` | **Frozen** — next audit (`hq/audit/plan.md` §7 bis). An iPadOS-style home screen: wallpaper + dock + widget grid, pure `layout-engine.ts`, imperative rAF drag (the reference for drag & motion). Data still from `modules/dashboard/service.ts`. |
| Tasks | `modules/tasks` (schema `public`) | Frozen. Kanban, workspaces → projects → statuses → tasks, real-time multi-user. |
| Habits, Goals, Journal, Books | `modules/*` | Frozen. V1/V2 shipped in spring 2026. |
| Settings, orgs, onboarding, command-center (⌘K), styleguide (`/settings/styleguide`) | `modules/*` | Shared plumbing. |

**Condition 3 of the freeze**: do not touch a frozen module, even for one line — a feature that
needs one goes to the partner module's backlog with its trigger.

## 4. Non-negotiable rules

1. **One status writer** (Watching): every status change goes through `lib/watch-status.ts` +
   `useWatchActions`. A robot writes posture only on proof of growth.
2. **Aired ≠ announced**: state is a calculation from what actually aired (`lib/series-state.ts`),
   never a stored flag.
3. **Every DB change is a versioned migration**, applied by the owner with `npx supabase db push
   --linked`, and the same commit updates `supabase/checks/expected-objects.json`
   (`_migrations_through` + object counts). CI (`check-schema-reference.mjs`) refuses otherwise.
4. **A cron never contains a key**: `select internal.call_edge('<fn>', payload)`. Edge functions
   read `HEGON_SECRET_KEY` (the auto-injected `SUPABASE_SERVICE_ROLE_KEY` inside a function is a
   dead legacy key; the Vercel/`.env.local` variable of the same name is the live one).
5. **Never two robots the same minute** (12 crons at :00 = 504s). Robots retry once
   (`_shared/retry.ts` `fetchWithRetry`) and answer **500 when everything failed** — a 200 wrapping
   a list of failures is a silent death the watchdog cannot see.
6. **Verify by executing**: `tsc`/`eslint` green proves nothing about the app. Screenshots read,
   database queried, robot run by hand. Say what could not be verified.
7. **Perf claims are A/B numbers**, before/after, same run, warmed.
8. **UI copy in English** from the first draft (dates `en-GB`).
9. **Design system is code** (`src/shared/components/ui` + tokens in `globals.css` / `DESIGN.md`).
   No decorative accent lines; depth = surface + scale. Glass only where content moves behind it
   (dashboard). Radius tokens only (`chip` 6 · `control`/`tile` 8 · `card` 12 · `modal` 16).
10. **Responsive = 4 devices**: mobile · iPad portrait `md` · iPad landscape `lg` (touch →
    `can-hover`) · desktop `xl`. A route's skeleton mirrors its surface at every width.
11. **Files are CRLF** under `src/**` and `supabase/functions/**`: edit with a script that detects
    the EOL; heredocs and `node -e` eat backslashes (`\b` → backspace). `sed -i` rewrites a whole
    file to LF.

## 5. Never touch

`src/infrastructure/supabase/{client,server}.ts` · `src/infrastructure/auth/actions.ts` ·
`src/app/layout.tsx` · `src/app/auth/page.tsx` · `src/middleware.ts` (auth via `getClaims()`, local
JWT verification — measured 14× faster than `getUser()`). Auth architecture: whitelist + finalize
flow + middleware; a trigger on `auth.users` must `exception when others then return new`.

## 6. Keys, crons, robots

| Job | Key | Lives in |
|---|---|---|
| Get through the gateway (crons, signup trigger) | `sb_publishable_` (public, grants nothing) | `internal.call_edge` only |
| Privileged work (bypass RLS) | `hegon_server` (`sb_secret_`) | function secrets (`HEGON_SECRET_KEY`), Vercel, `.env.local` |

- 20 crons (`select jobname, schedule from cron.job`). Watching: `series-sync` every 4 h,
  `anime-cours` 6 h, `trending` daily, `for-you` every 5 days, `awards` Oscars/Emmys (twice a day
  in season, monthly otherwise), `people` Tuesday 05:35 (follows' upcoming work + unreleased owned
  titles). Deploy with `npx supabase functions deploy <name>` (owner).
- **Watchdog** (`.github/workflows/watchdog.yml`, every 6 h): failed crons (A), functions in error
  twice in a row (B, via `internal.call_log` × `net._http_response`), stale tables (C — only for
  jobs that write every run), schema drift vs `expected-objects.json`, external ping
  (healthchecks.io). Weekly backup workflow (R11, restore proven 2026-09-13).
- Verify a key by **sha256 digest + a real invocation that writes**, never by a UI saying "Updated".

## 7. Commands and CI gates

```bash
npm run dev            # owner runs it on :3000 — do not start a second one that takes the lock
npm run build          # production build (CI gate)
npm run lint           # eslint --max-warnings 0 (pre-commit gate: a WARNING blocks)
npm test               # vitest (366 tests)
npm run knip:ci        # dead files / deps (CI gate)
npm run ds:coverage    # regenerates src/modules/styleguide/coverage.generated.json — commit it with any component change (CI gate)
node scripts/check-schema-reference.mjs   # migrations vs expected-objects.json (CI gate)
npm run map            # repo map by module and size
node scripts/shoot.mjs <path> out.png     # Playwright screenshot of a route (auth state in scripts/.auth) — then READ the PNG
```
CI = lint → schema reference → typecheck → test → knip → ds:coverage → build. Simulate what CI
sees with `git clone . /c/ci-sim` (CI only sees what is versioned). `scripts/.shots/` = ad-hoc
verification scripts, outside git.

## 8. Working with the owner

- Zakaria decides; the agent proposes work, never proposes to stop. A question ("what do you
  think?") means **discuss and wait for a go**.
- **Git**: give the `git add … && git commit -m "…"` command, never run it. One line, what and
  why, **no Co-Authored-By, no AI mention**. One commit per validated block. Migrations and
  function deploys are run by the owner; the agent gives the command and verifies afterwards.
- The agent finds the bugs (dead code, inconsistencies) unasked; it only asks about real
  product/design trade-offs — and challenges every decision against Linear / Apple / Vercel.
- Record progress in `hq/` (see `hq/session-protocol.md`), not in chat. `hq/rules/lessons.md`
  holds the traps that already cost a night — read it once.
