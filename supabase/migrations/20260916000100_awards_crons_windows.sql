-- Le Musée — les crons awards : chauds pendant la saison, mensuels le reste de l'année (2026-09-16)
--
-- Exigence owner : une nomination ou une victoire annoncée aujourd'hui est dans HEGON sous 12 h.
-- Oscars : nominations mi-janvier, cérémonie mi-mars → deux passages par jour de janvier à mars.
-- Emmys  : nominations mi-juillet, cérémonie mi-septembre → deux passages par jour de juillet à
-- septembre. Hors saison, un passage mensuel pour les corrections (Wikidata se remplit pendant des
-- mois ; emmys.com corrige aussi). Un cron ne sait pas dire « quotidien ces mois-là, mensuel
-- sinon » → deux jobs par cérémonie.
--
-- Créneaux vérifiés contre les 17 crons existants (règle R9, jamais deux robots la même minute,
-- et pas dans la traîne d'un long) : les anciens 04:55 / 05:55 tombaient 5 min après
-- watching-for-you (04:50, tous les 5 jours, plusieurs minutes de TMDB). Nouveaux créneaux :
--   03:25 / 15:25 Oscars   (rien à 03:xx sauf football-teams le 1er à 03:45 ; 15:35 = matchs, 1 min)
--   03:55 / 15:55 Emmys    (30 s de travail)
-- Loin du watchdog (:20 toutes les 6 h), de series-sync (:05 toutes les 4 h), de for-you (04:50).

do $awards_cron$
declare j record; n text;
begin
  foreach n in array array['watching-awards-oscars-monthly', 'watching-awards-emmys-monthly'] loop
    if exists (select 1 from cron.job where jobname = n) then perform cron.unschedule(n); end if;
  end loop;
  for j in
    select * from (values
      -- Oscars : saison janvier–mars, deux fois par jour ; hors saison le 3 du mois
      ('watching-awards-oscars-season',  '25 3,15 * 1-3 *',
       'select internal.call_edge(''watching-awards-sync'', ''{"ceremony":"oscars"}''::jsonb);'),
      ('watching-awards-oscars-monthly', '25 3 3 4-12 *',
       'select internal.call_edge(''watching-awards-sync'', ''{"ceremony":"oscars"}''::jsonb);'),
      -- Emmys : saison juillet–septembre, deux fois par jour ; hors saison le 3 du mois
      ('watching-awards-emmys-season',   '55 3,15 * 7-9 *',
       'select internal.call_edge(''watching-awards-sync'', ''{"ceremony":"emmys"}''::jsonb);'),
      ('watching-awards-emmys-monthly',  '55 3 3 1-6,10-12 *',
       'select internal.call_edge(''watching-awards-sync'', ''{"ceremony":"emmys"}''::jsonb);')
    ) as t(jobname, schedule, command)
  loop
    if exists (select 1 from cron.job where jobname = j.jobname) then perform cron.unschedule(j.jobname); end if;
    perform cron.schedule(j.jobname, j.schedule, j.command);
  end loop;
end
$awards_cron$;

-- VÉRIFIER : select jobname, schedule from cron.job where jobname like 'watching-awards-%' order by 1;  -- 4 lignes
