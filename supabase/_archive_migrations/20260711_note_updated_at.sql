-- My Take needs to say WHEN you wrote your review.
-- `updated_at` can't answer that: it moves whenever the status, the progress or the rating
-- changes, so "Reviewed on…" would show the date of something unrelated. This column moves
-- only when the note itself changes.

alter table watching.media_items
  add column if not exists note_updated_at timestamptz;

-- Backfill: existing notes get the row's last-touch date. It's the best available
-- approximation for rows written before this column existed, and it's only ever used for
-- rows that already have a note.
update watching.media_items
   set note_updated_at = updated_at
 where notes is not null
   and btrim(notes) <> ''
   and note_updated_at is null;

create or replace function watching.touch_note_updated_at()
returns trigger
language plpgsql
as $$
begin
  -- Only the note's own edits stamp it (NULL <-> text counts as a change).
  if new.notes is distinct from old.notes then
    new.note_updated_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_touch_note_updated_at on watching.media_items;

create trigger trg_touch_note_updated_at
  before update on watching.media_items
  for each row
  execute function watching.touch_note_updated_at();
