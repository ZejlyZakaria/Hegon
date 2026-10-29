-- Owner-authorized year-only correction, not a provider release-date inference.
-- Add missing FIRST_WATCH S2E41-48; existing E49/E50 dates and all opinions stay intact.
-- Canonical overlap subtraction moves192 minutes from legacy2023 to2026, total unchanged.
BEGIN;
DO $repair$
DECLARE
  owner_id constant uuid := 'de7f45de-8e7d-4b85-ab7e-a03b4bf8eb64';
  organization constant uuid := '26f017a1-c27f-4690-9032-317e3193373d';
  media_id constant uuid := 'f113dc29-35b8-45d0-b501-f007f486a958';
  operation constant uuid := 'df0ae049-27fa-47ae-b51d-ef0a8fd8356e';
  command constant jsonb := $part4${"mode":"update","media_id":"f113dc29-35b8-45d0-b501-f007f486a958","operation_key":"df0ae049-27fa-47ae-b51d-ef0a8fd8356e","expected_revision":8,"patch":{},"retract_ids":[],"records":[{"kind":"FIRST_WATCH","scope_kind":"EPISODES","scope_key":null,"completion_basis":null,"scope_confidence":"CONFIRMED","year":2026,"month":null,"day":null,"date_precision":"YEAR","date_confidence":"CONFIRMED","origin":"USER_CORRECTION","ranges":[{"season_key":"tmdb-season:2","season_number_at_recording":2,"episode_from":41,"episode_to":48,"episode_ids":[7338204,7470569,7470571,7470573,7470575,7470576,7470577,7470579],"minutes":192,"duration_basis":"RUNTIME_SNAPSHOT"}]}],"reason":"Owner confirmed all S2 Part 4 (EP41-50) first viewed in 2026; add only missing EP41-48 at YEAR precision; preserve existing EP49-50 dates and accepted legacy24-minute estimate, not a provider-runtime recalculation."}$part4$;
  item watching.media_items;
  original jsonb; saved jsonb; episode_ids jsonb;
  old_sub text := current_setting('request.jwt.claim.sub',true);
  old_claims text := current_setting('request.jwt.claims',true);
BEGIN
  IF EXISTS(SELECT 1 FROM watching.viewing_records WHERE user_id=owner_id AND operation_key=operation) THEN
    IF NOT EXISTS(SELECT 1 FROM watching.viewing_records WHERE user_id=owner_id AND operation_key=operation
      AND operation_hash=md5(command::text) AND media_item_id=media_id AND kind='FIRST_WATCH'
      AND year=2026 AND month IS NULL AND day IS NULL AND date_precision='YEAR' AND retracted_at IS NULL) THEN
      RAISE EXCEPTION 'Bleach Part4 operation identity mismatch';
    END IF;
    RETURN;
  END IF;
  -- Same provider-before-media lock order as the existing guarded command.
  PERFORM pg_advisory_xact_lock(hashtextextended('watching-provider:tv:30984',0));
  IF (SELECT accepted_snapshot_id FROM watching.provider_heads WHERE provider='tmdb' AND work_key='tv:30984')
     IS DISTINCT FROM '80ae912f-ba80-4597-82e8-3dff90ad2afd'::uuid THEN
    RAISE EXCEPTION 'Bleach Part4 catalogue changed; recheck before applying';
  END IF;
  IF (SELECT cours FROM watching.anime_cours WHERE tmdb_id=30984 AND source='anilist')
     IS DISTINCT FROM $cours$[{"year":2004,"title":"Bleach","season":1,"end_year":2012,"episodes":366,"anilist_id":269,"poster_url":"https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx269-d2GmRkJbMopq.png","end_episode":366,"start_episode":1},{"year":2022,"title":"BLEACH: Thousand-Year Blood War","season":2,"end_year":2022,"episodes":13,"anilist_id":116674,"poster_url":"https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx116674-p3zK4PUX2Aag.jpg","end_episode":379,"start_episode":367},{"year":2023,"title":"BLEACH: Thousand-Year Blood War - The Separation","season":3,"end_year":2023,"episodes":13,"anilist_id":159322,"poster_url":"https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx159322-Sp1GflRhE6Po.jpg","end_episode":392,"start_episode":380},{"year":2024,"title":"BLEACH: Thousand-Year Blood War - The Conflict","season":4,"end_year":2024,"episodes":14,"anilist_id":169755,"poster_url":"https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx169755-Rqb7MjnzdTc6.jpg","end_episode":406,"start_episode":393},{"year":2026,"title":"BLEACH: Thousand-Year Blood War - The Calamity","season":5,"end_year":2026,"episodes":10,"anilist_id":185874,"poster_url":"https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx185874-aU3e6tBT6wwA.jpg","end_episode":416,"start_episode":407}]$cours$::jsonb THEN
    RAISE EXCEPTION 'Bleach Part4 mapping changed; recheck before applying';
  END IF;
  SELECT jsonb_agg(e->'id' ORDER BY (e->>'number')::integer) INTO episode_ids
    FROM watching.provider_snapshots p,jsonb_array_elements(p.facts->'seasons') season,
      jsonb_array_elements(season->'episodes') e
    WHERE p.id='80ae912f-ba80-4597-82e8-3dff90ad2afd' AND (season->>'number')::integer=2
      AND (e->>'number')::integer BETWEEN 41 AND 48 AND (e->>'aired')::boolean;
  IF episode_ids IS DISTINCT FROM command->'records'->0->'ranges'->0->'episode_ids' THEN
    RAISE EXCEPTION 'Bleach Part4 episode membership changed';
  END IF;
  SELECT * INTO item FROM watching.media_items WHERE id=media_id FOR UPDATE;
  IF NOT FOUND OR item.user_id<>owner_id OR item.org_id<>organization OR item.tmdb_id<>30984 OR item.type<>'anime'
    OR item.personal_revision<>8 OR NOT item.watched OR item.in_progress
    OR item.current_season<>2 OR item.current_episode<>50 OR item.season_aired IS DISTINCT FROM ARRAY[366,50]
    OR item.watched_at IS DISTINCT FROM timestamp '2026-10-28 12:00:00'
    OR item.season_years IS DISTINCT FROM '{"1":2020,"2":2023}'::jsonb
    OR item.legacy_consumption IS DISTINCT FROM $legacy${"counts":[366,49],"runtime":24,"version":1,"completed":false,"captured_at":"2026-10-22T00:40:40.549226+00:00","calendar_date":"2023-12-31T12:00:00","fallback_year":2026,"storage_sizes":[366,50]}$legacy$::jsonb THEN
    RAISE EXCEPTION 'Bleach Part4 personal data changed; recheck before applying';
  END IF;
  IF EXISTS(SELECT 1 FROM watching.viewing_records r JOIN watching.viewing_ranges v ON v.viewing_record_id=r.id
    WHERE r.media_item_id=media_id AND r.kind='FIRST_WATCH' AND v.season_number_at_recording=2
      AND v.episode_from<=48 AND v.episode_to>=41) THEN
    RAISE EXCEPTION 'Bleach Part4 already has first-view coverage; recheck before applying';
  END IF;
  IF (SELECT count(DISTINCT v.episode_from) FROM watching.viewing_records r JOIN watching.viewing_ranges v ON v.viewing_record_id=r.id
    WHERE r.media_item_id=media_id AND r.user_id=owner_id AND r.org_id=organization AND r.kind='FIRST_WATCH'
      AND r.retracted_at IS NULL AND r.year=2026 AND r.month=10 AND r.date_confidence='CONFIRMED'
      AND v.season_number_at_recording=2 AND v.episode_from=v.episode_to
      AND ((v.episode_from=49 AND r.day=20) OR (v.episode_from=50 AND r.day=28)))<>2 THEN
    RAISE EXCEPTION 'Bleach existing E49/E50 dates changed';
  END IF;
  original:=to_jsonb(item);
  PERFORM set_config('request.jwt.claim.sub',owner_id::text,true);
  PERFORM set_config('request.jwt.claims',jsonb_build_object('sub',owner_id,'role','authenticated')::text,true);
  saved:=watching.personal_history_command(command);
  PERFORM set_config('request.jwt.claim.sub',coalesce(old_sub,''),true);
  PERFORM set_config('request.jwt.claims',coalesce(old_claims,''),true);
  IF (saved-ARRAY['updated_at','personal_revision','personal_operation_key','personal_operation_hash']) IS DISTINCT FROM
     (original-ARRAY['updated_at','personal_revision','personal_operation_key','personal_operation_hash'])
     OR (saved->>'personal_revision')::bigint<>(original->>'personal_revision')::bigint+1 THEN
    RAISE EXCEPTION 'Bleach Part4 repair changed an unrelated personal field';
  END IF;
END $repair$;
COMMIT;
