-- Books — per-org reading settings (monthly pages target for the Activity chart).
-- Mirrors the sport_*_user_settings pattern: one row per org, RLS org-isolated.

CREATE TABLE public.book_user_settings (
  org_id               uuid        PRIMARY KEY REFERENCES public.organizations ON DELETE CASCADE,
  monthly_pages_target int,                                  -- NULL = no target line drawn
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER book_user_settings_updated_at
  BEFORE UPDATE ON public.book_user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.book_user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON public.book_user_settings
  USING     (org_id IN (SELECT * FROM public.my_orgs()))
  WITH CHECK (org_id IN (SELECT * FROM public.my_orgs()));
