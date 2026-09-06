-- Deleting a list was a HARD delete, and media_list_items cascades off it. One click on a
-- hover icon — no confirmation, no undo — and a list plus every title in it was gone from the
-- database. It happened: a 9-title list was destroyed by a single stray click, and the only
-- way back was a Supabase backup. Meanwhile deleting a single TITLE has always asked for
-- confirmation. The most destructive action in the module was the least protected one.
--
-- A list is now soft-deleted: the row survives, its items survive, and it simply stops being
-- read. Undo becomes a column write instead of an act of archaeology.
--
-- Purging (if ever) is a deliberate, separate decision — not a side effect of a mis-click.

alter table watching.media_lists
  add column if not exists deleted_at timestamptz;

comment on column watching.media_lists.deleted_at is
  'Soft delete. Non-null = deleted; the row and its media_list_items are kept so the action can be undone. Every read filters on deleted_at is null.';

-- Every read filters `deleted_at is null`, so the index carries that predicate.
create index if not exists media_lists_live_idx
  on watching.media_lists (user_id, created_at)
  where deleted_at is null;
