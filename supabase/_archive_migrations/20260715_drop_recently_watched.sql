-- DROP `recently_watched` — a dead column.
--
-- It was a STORED boolean, set once at add time by an arbitrary 30-day window and never cleared, so
-- the section it drove showed "what came through this door", not "what you watched recently". That
-- section ("Last Watched") is now DERIVED from `watched_at` — ordered by the date, capped to the
-- last ten. Nothing reads this flag for any decision any more: not the section query, not the add
-- resolver, not Stats. A read-only diagnostic confirmed it (hq/audit/db-diagnostic-watching.md):
-- 100% populated, ~5 writers, zero decision-readers.
--
-- The code that wrote it is already gone. This removes the column it was writing to.

alter table watching.media_items
  drop column if exists recently_watched;
