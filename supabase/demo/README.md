# `supabase/demo/`

Operational SQL for the **read-only demo account** (the LinkedIn showcase).

These scripts are **run manually** from the Supabase SQL editor — they are *not*
part of the standard `supabase/migrations/` pipeline (a `db push` / `db reset`
will not replay them). That's intentional: the demo is a manual, owner-only setup
(you also create the demo auth user by hand).

## How the demo works

- The demo user lives in its **own org** → `org_isolation` keeps your real data
  completely separate. A visitor can never reach or modify your account.
- **Read-only** is enforced at the DB layer: `public.is_demo_user()` +
  `RESTRICTIVE` policies that deny `INSERT/UPDATE/DELETE` for demo users (SELECT
  is untouched). Defined per module.
- Each module is seeded with a **coherent fictional persona** (a developer
  leveling up). Watching is the exception — it copies real films (not sensitive).
- Modules are revealed in the demo Dock via the owner **"Demo & Sharing"** panel
  (`set_demo_visible_modules`), so you control the reveal on your posting schedule.

## Run order (per module)

1. Paste + run the module's SQL file once → creates the read-only policies + seed
   function.
2. Run the seed: `SELECT public.seed_demo_<module>('demo@example.com');`
   (re-runnable — wipes the demo's data for that module, then re-seeds).
3. Reveal the module from the **Demo & Sharing** panel when you post about it.

## Files

| File | Module | Seed call |
|------|--------|-----------|
| `20260628_demo_habits.sql` | Habits | `SELECT public.seed_demo_habits('demo@example.com');` |
| `20260630_demo_tasks.sql` | Tasks | `SELECT public.seed_demo_tasks('demo@example.com');` |
| `20260630_demo_goals.sql` | Goals | `SELECT public.seed_demo_goals('demo@example.com');` (run **after** Tasks + Habits — it links to them) |
| `20260630_demo_books.sql` | Books | `SELECT public.seed_demo_books('demo@example.com');` |
| `20260701_demo_journal.sql` | Journal | `SELECT public.seed_demo_journal('demo@example.com');` (needs the journal migrations applied) |

> The original demo scaffolding (account flag, Watching seed, module control)
> still lives in `supabase/migrations/20260603_demo_*` — already applied. It can
> be moved here too if you confirm you apply everything manually.
