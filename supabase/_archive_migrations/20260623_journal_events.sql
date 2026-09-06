-- Journal — important dates / reminders pinned to a date. Shown as calendar
-- markers + an "Events" card, and (later) surfaced on the Dashboard.
-- RLS org-isolated, same pattern as journal_entries.

CREATE TABLE public.journal_events (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      uuid        NOT NULL REFERENCES public.organizations ON DELETE CASCADE,
  user_id     uuid        NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  event_date  date        NOT NULL,
  title       text        NOT NULL,
  note        text,
  type        text        NOT NULL DEFAULT 'reminder',   -- reminder | birthday | anniversary | deadline | milestone
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX journal_events_org_date_idx ON public.journal_events (org_id, event_date);

CREATE TRIGGER journal_events_updated_at
  BEFORE UPDATE ON public.journal_events
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.journal_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public.journal_events
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));
