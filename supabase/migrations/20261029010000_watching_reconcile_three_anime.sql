-- Owner-approved Wave2E residual cleanup at the already-confirmed true positions.
-- No cursor/status/global-rating/hour changes; no invented dates or history.
-- Separate from the generic no-backfill migration; exact originals remain in audit.
BEGIN;
DO $repair$
DECLARE
  spec jsonb; item watching.media_items; original jsonb; saved jsonb;
  expected jsonb; actual jsonb; fingerprint text; prior watching.progress_corrections;
BEGIN
  FOR spec IN SELECT value FROM jsonb_array_elements($manifest$[{"id":"2cd01fba-e6eb-401f-b46c-102ff2bf7fb1","operation_key":"9e2e0029-0000-4000-8000-000000000001","before":{"id":"2cd01fba-e6eb-401f-b46c-102ff2bf7fb1","user_id":"de7f45de-8e7d-4b85-ab7e-a03b4bf8eb64","org_id":"26f017a1-c27f-4690-9032-317e3193373d","type":"anime","tmdb_id":61374,"current_season":2,"current_episode":12,"watched":false,"in_progress":false,"paused":false,"dropped":true,"want_to_watch":false,"user_rating":8.5,"season_years":{"1":2017,"2":2017,"3":2019},"season_ratings":{"1":8.5,"2":8.5,"3":7.5},"cour_years":{},"cour_ratings":{},"watched_at":"2019-12-31T12:00:00","viewing_date":null,"last_watched_at":null,"caught_up_at":null,"legacy_consumption":{"counts":[12,12,0,0],"runtime":24,"version":1,"completed":false,"captured_at":"2026-10-22T00:40:40.549226+00:00","fallback_year":2026,"storage_sizes":[12,12,12,12]},"personal_revision":0,"history_version":0,"personal_operation_key":null,"personal_operation_hash":null},"patch":{"season_years":{"1":2017,"2":2017},"season_ratings":{"1":8.5,"2":8.5},"watched_at":null,"legacy_consumption":{"counts":[12,12,0,0],"runtime":24,"version":1,"completed":false,"captured_at":"2026-10-22T00:40:40.549226+00:00","fallback_year":2026,"storage_sizes":[12,12,12,12],"calendar_date":null}}},{"id":"8ed58c64-7295-4aa6-b92a-2fee417d2753","operation_key":"9e2e0029-0000-4000-8000-000000000002","before":{"id":"8ed58c64-7295-4aa6-b92a-2fee417d2753","user_id":"de7f45de-8e7d-4b85-ab7e-a03b4bf8eb64","org_id":"26f017a1-c27f-4690-9032-317e3193373d","type":"anime","tmdb_id":88046,"current_season":1,"current_episode":18,"watched":false,"in_progress":false,"paused":true,"dropped":false,"want_to_watch":false,"user_rating":null,"season_years":{"1":2024,"2":2025},"season_ratings":{"1":8.5},"cour_years":{},"cour_ratings":{},"watched_at":null,"viewing_date":null,"last_watched_at":null,"caught_up_at":null,"legacy_consumption":{"counts":[18,0,0],"runtime":24,"version":1,"completed":false,"captured_at":"2026-10-22T00:40:40.549226+00:00","fallback_year":2026,"storage_sizes":[24,24,25]},"personal_revision":0,"history_version":0,"personal_operation_key":null,"personal_operation_hash":null},"patch":{"season_years":{"1":2024},"season_ratings":{"1":8.5},"watched_at":null,"legacy_consumption":{"counts":[18,0,0],"runtime":24,"version":1,"completed":false,"captured_at":"2026-10-22T00:40:40.549226+00:00","fallback_year":2026,"storage_sizes":[24,24,25]}}},{"id":"b497afae-6ff1-4481-be2e-22e9cd398ea9","operation_key":"9e2e0029-0000-4000-8000-000000000003","before":{"id":"b497afae-6ff1-4481-be2e-22e9cd398ea9","user_id":"de7f45de-8e7d-4b85-ab7e-a03b4bf8eb64","org_id":"26f017a1-c27f-4690-9032-317e3193373d","type":"anime","tmdb_id":62104,"current_season":2,"current_episode":24,"watched":false,"in_progress":false,"paused":false,"dropped":true,"want_to_watch":false,"user_rating":7.5,"season_years":{"1":2017,"2":2019,"3":2024,"4":2021},"season_ratings":{},"cour_years":{},"cour_ratings":{},"watched_at":null,"viewing_date":null,"last_watched_at":null,"caught_up_at":null,"legacy_consumption":{"counts":[24,24,0,0],"runtime":24,"version":1,"completed":false,"captured_at":"2026-10-22T00:40:40.549226+00:00","fallback_year":2026,"storage_sizes":[24,24,24,24]},"personal_revision":0,"history_version":0,"personal_operation_key":null,"personal_operation_hash":null},"patch":{"season_years":{"1":2017,"2":2019},"season_ratings":{},"watched_at":null,"legacy_consumption":{"counts":[24,24,0,0],"runtime":24,"version":1,"completed":false,"captured_at":"2026-10-22T00:40:40.549226+00:00","fallback_year":2026,"storage_sizes":[24,24,24,24]}}}]$manifest$::jsonb) LOOP
    fingerprint:=md5(spec::text);
    PERFORM pg_advisory_xact_lock(hashtextextended('watching-provider:tv:'||(spec->'before'->>'tmdb_id'),0));
    SELECT * INTO item FROM watching.media_items WHERE id=(spec->>'id')::uuid FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Wave2E target missing: %',spec->>'id'; END IF;
    SELECT * INTO prior FROM watching.progress_corrections WHERE operation_key=(spec->>'operation_key')::uuid;
    IF FOUND THEN
      IF prior.operation_hash<>fingerprint OR prior.media_item_id<>item.id OR prior.user_id<>item.user_id OR prior.org_id<>item.org_id THEN
        RAISE EXCEPTION 'Wave2E operation identity mismatch';
      END IF;
      CONTINUE;
    END IF;
    original:=to_jsonb(item);
    SELECT jsonb_object_agg(key,original->key) INTO actual FROM jsonb_object_keys(spec->'before') key;
    IF actual IS DISTINCT FROM spec->'before' THEN RAISE EXCEPTION 'Wave2E personal state changed: %',item.title; END IF;
    IF EXISTS(SELECT 1 FROM watching.viewing_records WHERE user_id=item.user_id AND org_id=item.org_id AND (media_item_id=item.id OR work_key='tv:'||item.tmdb_id))
      OR EXISTS(SELECT 1 FROM watching.scope_ratings WHERE user_id=item.user_id AND org_id=item.org_id AND (media_item_id=item.id OR work_key='tv:'||item.tmdb_id))
      OR EXISTS(SELECT 1 FROM watching.rewatches WHERE media_item_id=item.id) THEN
      RAISE EXCEPTION 'Wave2E new independent history/opinions require review: %',item.title;
    END IF;
    UPDATE watching.media_items SET
      season_years=spec->'patch'->'season_years',season_ratings=spec->'patch'->'season_ratings',
      watched_at=(spec->'patch'->>'watched_at')::timestamp,
      legacy_consumption=spec->'patch'->'legacy_consumption',
      personal_operation_key=(spec->>'operation_key')::uuid,personal_operation_hash=fingerprint,updated_at=now()
      WHERE id=item.id RETURNING to_jsonb(media_items) INTO saved;
    expected:=original||(spec->'patch');
    IF saved-ARRAY['updated_at','personal_revision','personal_operation_key','personal_operation_hash'] IS DISTINCT FROM
       expected-ARRAY['updated_at','personal_revision','personal_operation_key','personal_operation_hash']
       OR (saved->>'personal_revision')::bigint<>(original->>'personal_revision')::bigint+1 THEN
      RAISE EXCEPTION 'Wave2E repair changed unrelated data: %',item.title;
    END IF;
    INSERT INTO watching.progress_corrections(operation_key,operation_hash,user_id,org_id,media_item_id,work_key,before_state,after_state,reason)
      VALUES((spec->>'operation_key')::uuid,fingerprint,item.user_id,item.org_id,item.id,'tv:'||item.tmdb_id,original,saved,
        'Owner-confirmed true current position; retire false legacy season years/opinion and exclusively false Tokyo Ghoul calendar; retain valid consumption, opinions and posture');
  END LOOP;
END $repair$;
COMMIT;
