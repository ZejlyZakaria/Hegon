-- Phase 1 — Multi-tenancy
-- Migration 4 : trigger auto-org à l'inscription

-- Fonction appelée à chaque nouveau user dans auth.users.
-- Crée automatiquement une org personnelle + membership owner.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_org_id uuid;
  org_name   text;
  org_slug   text;
BEGIN
  -- Nom de l'org : full_name si dispo, sinon partie avant @ de l'email
  org_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- Slug : lowercase + only alphanumeric/hyphens + suffix unique basé sur l'id
  org_slug := lower(regexp_replace(split_part(NEW.email, '@', 1), '[^a-z0-9]', '-', 'g'))
              || '-'
              || left(replace(NEW.id::text, '-', ''), 8);

  -- Créer l'organisation personnelle
  INSERT INTO public.organizations (name, slug, plan)
  VALUES (org_name, org_slug, 'free')
  RETURNING id INTO new_org_id;

  -- Créer le membership owner
  INSERT INTO public.memberships (org_id, user_id, role)
  VALUES (new_org_id, NEW.id, 'owner');

  RETURN NEW;
END;
$$;

-- Attacher le trigger sur auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
