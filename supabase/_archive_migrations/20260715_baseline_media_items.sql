-- =============================================================================
-- BASELINE — watching.media_items (la table pré-migrations, enfin dans le repo)
-- =============================================================================
--
-- POURQUOI CE FICHIER
-- media_items est la plus vieille table du module : créée à la main dans le
-- dashboard Supabase AVANT qu'on utilise des fichiers de migration. Résultat, sa
-- vérité était éclatée entre la DB live et ~20 `ALTER TABLE`. Pire, l'audit du
-- 2026-07-15 (hq/audit/db-schema-audit.md) l'a prouvé via `pg_indexes` : la table
-- porte 8 index + une contrainte d'unicité dont SIX + l'unique n'existaient dans
-- AUCUNE migration. Une recréation depuis le repo (nouveau projet, restauration,
-- 2ᵉ dev) les aurait perdus en silence → app lente + doublons possibles.
--
-- Ce fichier capture l'état RÉEL (colonnes/types/défauts relevés dans
-- information_schema, index relevés dans pg_indexes le 2026-07-15) pour que le
-- schéma redevienne reconstructible depuis le repo seul.
--
-- 100 % IDEMPOTENT + INERTE sur la base actuelle : tout est `IF NOT EXISTS`. La
-- table existe déjà → le CREATE ne s'exécute pas ; les index existent déjà → les
-- CREATE INDEX ne font rien. Ça ne MODIFIE rien. Ça DOCUMENTE.
--
-- ORDRE DES COLONNES : réorganisé du plus important au moins important, colonnes
-- liées côte à côte (demande owner). ⚠️ Postgres ne réordonne PAS une table
-- existante — cet ordre ne s'applique donc qu'à une recréation FUTURE. La table
-- live garde son ordre historique (sans impact : le code sélectionne par nom).
--
-- RLS + policies (org_isolation + demo_readonly_*) NE sont PAS ici : elles vivent
-- déjà, elles, en migration (20260412_phase1_rls_policies + 20260603_demo_account).
-- On ne les duplique pas. On se contente de (ré)affirmer que RLS est activé.
-- =============================================================================

create table if not exists watching.media_items (
  -- ── Clés : système, tenant, identité ──────────────────────────────────────
  id               uuid        not null default extensions.uuid_generate_v4(),
  org_id           uuid        not null,                       -- tenant (clé RLS org_isolation)
  user_id          uuid        not null,                       -- qui a ajouté la ligne
  tmdb_id          integer,                                    -- identité du titre dans le monde (TMDB)
  type             text        not null,                       -- 'film' | 'serie' | 'anime'

  -- ── Le titre : identité affichable (faits-du-monde) ───────────────────────
  title            text        not null,
  original_title   text,
  year             integer,
  release_date     date,                                       -- FILM only : date de sortie (calcul « Waiting for »)
  runtime          integer,                                    -- film = total min ; série = min/épisode
  description      text,
  poster_url       text,
  backdrop_url     text,
  rating           double precision,                           -- note TMDB (le monde) ≠ user_rating
  studio           varchar(255),
  tags             text[],                                     -- noms de genres TMDB
  directors        jsonb,
  cast_members     jsonb       not null default '[]'::jsonb,   -- top ~12, caché de TMDB

  -- ── Structure & diffusion des séries (faits-du-monde volatils) ────────────
  --    → candidats à sortir dans series_facts(tmdb_id) un jour (audit point B).
  status           varchar(20),                                -- 'ended' | 'ongoing' | 'canceled'
  seasons          integer,                                    -- dérivable de season_episodes.length
  episodes         integer,                                    -- dérivable de sum(season_episodes)
  season_episodes  jsonb,                                      -- ANNONCÉ par TMDB (par saison)
  season_aired     integer[],                                  -- DIFFUSÉ pour de vrai — seule source du progrès
  season_air_dates jsonb       not null default '[]'::jsonb,   -- début de chaque saison
  season_end_dates jsonb       not null default '[]'::jsonb,   -- fin de chaque saison (plancher des pickers d'année)
  season_posters   jsonb       not null default '[]'::jsonb,   -- poster_path TMDB par saison
  last_synced_at   timestamptz,                                -- dernier refresh TMDB (null = jamais)

  -- ── Ta position : listes d'appartenance + progression ─────────────────────
  watched          boolean     default false,
  in_progress      boolean     default false,
  paused           boolean     not null default false,
  dropped          boolean     not null default false,
  drop_reason      text,
  want_to_watch    boolean     default false,
  is_reference     boolean     not null default false,         -- stub ajouté à une liste, jamais suivi
  current_season   integer     default 1,
  current_episode  integer     default 0,
  caught_up_at     timestamptz,                                -- dernière fois à jour avec le diffusé

  -- ── Tes appréciations & dates perso ───────────────────────────────────────
  favorite         boolean     default false,
  priority         integer,                                    -- rang Top-10 (par type)
  priority_level   text,                                       -- urgence want-to-watch : high|medium|low
  user_rating      real,                                       -- TA note
  season_years     jsonb       not null default '{}'::jsonb,   -- { "<saison>": <année vue> }
  season_ratings   jsonb       not null default '{}'::jsonb,   -- { "<saison>": <note> }
  cour_years       jsonb       not null default '{}'::jsonb,   -- anime overlay : { "<cour>": <année> }
  cour_ratings     jsonb       not null default '{}'::jsonb,   -- anime overlay : { "<cour>": <note> }
  notes            text,
  note_updated_at  timestamptz,                                -- bougé UNIQUEMENT quand la note change (trigger)
  watched_at       timestamp,                                  -- 1er visionnage
  last_watched_at  timestamptz,                                -- dernier mouvement EN AVANT

  -- ── Système ───────────────────────────────────────────────────────────────
  created_at       timestamp   default now(),
  updated_at       timestamp   default now(),

  constraint media_items_pkey primary key (id)
);

-- RLS (les policies elles-mêmes sont dans 20260412_phase1_rls_policies +
-- 20260603_demo_account — on réaffirme juste l'activation, idempotent).
alter table watching.media_items enable row level security;

-- =============================================================================
-- INDEX — l'état RÉEL relevé dans pg_indexes le 2026-07-15.
-- C'est la partie qui avait divergé : 6 de ces 7 (+ l'unique) n'étaient nulle part.
-- =============================================================================

-- Isolation multi-tenant (prédicat RLS org_isolation).
create index if not exists idx_media_items_org_id
  on watching.media_items (org_id);

-- Tranche « mes titres » — préfixe de la plupart des lectures per-user.
create index if not exists idx_media_user_id
  on watching.media_items (user_id);

-- Filtre par type (faible sélectivité — 3 valeurs ; candidat à un nettoyage futur).
create index if not exists idx_media_type
  on watching.media_items (type);

-- Le cheval de bataille : son préfixe (user_id, type) sert TOUTES les sections,
-- et la forme complète sert la requête In Progress.
create index if not exists idx_media_items_in_progress
  on watching.media_items (user_id, type, watched, current_episode);

-- Tri de la section « Last Watched ».
create index if not exists idx_media_watched_at
  on watching.media_items (watched_at desc);

-- UNICITÉ : un titre (par type) n'existe qu'une fois par user. C'est ce qui
-- protège réellement le `.maybeSingle()` du code contre un doublon concurrent.
-- Son préfixe (user_id, tmdb_id) sert aussi les lookups par identité TMDB.
create unique index if not exists media_items_unique_user_tmdb
  on watching.media_items (user_id, tmdb_id, type);

-- Le job de sync ne demande qu'une chose : les séries pas terminées, refresh le
-- plus vieux d'abord.
create index if not exists media_items_sync_idx
  on watching.media_items (last_synced_at nulls first)
  where type <> 'film' and (status is null or status not in ('ended', 'canceled', 'cancelled'));

-- =============================================================================
-- COMMENTAIRES — la doc des colonnes non-évidentes (reprise des migrations
-- d'origine, pour qu'elle survive à la recréation).
-- =============================================================================

comment on column watching.media_items.season_aired is
  'Épisodes RÉELLEMENT DIFFUSÉS par saison. Seule source de vérité pour le progrès, le +1, le verrouillage d''épisode et la complétion. season_episodes est de l''annoncé et ne doit JAMAIS décider.';
comment on column watching.media_items.season_end_dates is
  'Date de diffusion du DERNIER épisode diffusé de chaque saison (null tant que la saison sort encore). Plancher de tout picker « année vue ». Rempli par le job de sync.';
comment on column watching.media_items.caught_up_at is
  'Dernière fois où tu avais vu tout ce qui était diffusé. Non-null = tu étais à jour ; sert à afficher « New episodes » quand le monde avance.';
comment on column watching.media_items.last_synced_at is
  'Dernier refresh TMDB de status / season_episodes / season_aired. Null = jamais synchronisé.';
comment on column watching.media_items.last_watched_at is
  'Quand tu as avancé pour la dernière fois DANS ce titre (épisode/saison, ou marqué vu). Jamais posé par une correction. Null = jamais capturé ; fallback sur la dernière année de saison atteinte.';
comment on column watching.media_items.note_updated_at is
  'Bougé UNIQUEMENT quand `notes` change (via trigger). updated_at bouge à chaque édition de statut → il ne pourrait jamais dater une critique.';
