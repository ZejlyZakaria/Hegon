-- ── Custom Lists for Watching module ──────────────────────────────────────────

-- Table: media_lists
CREATE TABLE watching.media_lists (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      uuid        NOT NULL,
  name        text        NOT NULL,
  description text,
  emoji       text,
  color       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE watching.media_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON watching.media_lists
  FOR ALL TO public
  USING (
    org_id IN (SELECT my_orgs.my_orgs FROM my_orgs() my_orgs(my_orgs))
  )
  WITH CHECK (
    org_id IN (SELECT my_orgs.my_orgs FROM my_orgs() my_orgs(my_orgs))
  );

-- Table: media_list_items
CREATE TABLE watching.media_list_items (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id       uuid        NOT NULL REFERENCES watching.media_lists(id) ON DELETE CASCADE,
  media_item_id uuid        NOT NULL REFERENCES watching.media_items(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users(id),
  org_id        uuid        NOT NULL,
  position      integer     NOT NULL DEFAULT 0,
  note          text,
  added_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (list_id, media_item_id)
);

ALTER TABLE watching.media_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON watching.media_list_items
  FOR ALL TO public
  USING (
    org_id IN (SELECT my_orgs.my_orgs FROM my_orgs() my_orgs(my_orgs))
  )
  WITH CHECK (
    org_id IN (SELECT my_orgs.my_orgs FROM my_orgs() my_orgs(my_orgs))
  );
