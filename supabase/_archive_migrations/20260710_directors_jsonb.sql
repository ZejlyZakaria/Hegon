-- `directors` was created as `json`; the containment operator `@>` only exists on
-- `jsonb`, so Person-page queries (getTitlesByPerson → directors cs [{id}]) fail with
-- "operator does not exist: json @> unknown". cast_members is already jsonb — align
-- directors so director person-pages can match "your titles with this director".
alter table watching.media_items
  alter column directors type jsonb using directors::jsonb;
