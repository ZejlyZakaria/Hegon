-- Category taxonomy refresh — sharper, life-covering pillars:
--   work → career   ·   personal → lifestyle   ·   learning → growth
--   (health, finance, other unchanged)
-- Order: drop the old CHECK, remap existing rows, add the new CHECK.

ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS goals_category_check;

UPDATE public.goals SET category = CASE category
  WHEN 'work'     THEN 'career'
  WHEN 'personal' THEN 'lifestyle'
  WHEN 'learning' THEN 'growth'
  ELSE category
END
WHERE category IN ('work', 'personal', 'learning');

ALTER TABLE public.goals
  ADD CONSTRAINT goals_category_check
  CHECK (category IN ('career', 'health', 'finance', 'growth', 'lifestyle', 'other'));
