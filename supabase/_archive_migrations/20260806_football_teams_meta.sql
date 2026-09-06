-- =====================================================================
-- Football — team meta (club fiche v2 : couleurs + site)
-- =====================================================================
-- À APPLIQUER À LA MAIN (copier-coller dans le SQL editor Supabase). Jamais `db push`.
--
-- football_teams porte déjà short_name, tla, founded, venue, country. L'endpoint que le sync mensuel
-- appelle déjà (/competitions/{code}/teams) renvoie EN PLUS `clubColors` et `website` gratuitement —
-- ces deux colonnes permettent au sync de les stocker, ce qui alimente la fiche club (Team Panel v2)
-- sans un seul appel API supplémentaire.
-- =====================================================================

alter table sport.football_teams add column if not exists club_colors text;
alter table sport.football_teams add column if not exists website     text;
