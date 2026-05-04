-- Allow ratings to be linked to a match directly (no trade_proposal required)
ALTER TABLE public.user_ratings ALTER COLUMN trade_id DROP NOT NULL;
ALTER TABLE public.user_ratings ADD COLUMN IF NOT EXISTS match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE;

-- Unique: one rating per rater per match
DROP INDEX IF EXISTS user_ratings_trade_id_rater_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS user_ratings_match_rater
  ON public.user_ratings (match_id, rater_id)
  WHERE match_id IS NOT NULL;
