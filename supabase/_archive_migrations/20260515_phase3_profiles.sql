-- Phase 3 — Profiles utilisateurs
-- Table profiles : données publiques des users (avatar, nom) pour les assignees

CREATE TABLE public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      text,
  full_name  text,
  avatar_url text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles are viewable by everyone"
  ON public.profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Mise à jour du trigger handle_new_user pour créer un profil à l'inscription
-- (le trigger on_auth_user_created existait déjà via phase1_auto_org_trigger.sql)
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

  -- Créer le profil public
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );

  RETURN NEW;
END;
$$;

-- Note : les profils des users existants ont été insérés manuellement via :
-- INSERT INTO public.profiles (id, email, full_name, avatar_url)
-- SELECT id, email, raw_user_meta_data->>'full_name', raw_user_meta_data->>'avatar_url'
-- FROM auth.users;
