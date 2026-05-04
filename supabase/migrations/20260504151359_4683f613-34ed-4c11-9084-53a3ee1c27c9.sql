CREATE TABLE IF NOT EXISTS public.user_ratings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID NOT NULL,
  rater_id UUID NOT NULL,
  rated_id UUID NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  on_time BOOLEAN NOT NULL DEFAULT true,
  had_stickers BOOLEAN NOT NULL DEFAULT true,
  comment TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (match_id, rater_id)
);

ALTER TABLE public.user_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ratings readable by all authenticated"
  ON public.user_ratings FOR SELECT TO authenticated USING (true);

CREATE POLICY "match members insert own ratings"
  ON public.user_ratings FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = rater_id
    AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id
        AND ((m.user_a = auth.uid() AND m.user_b = rated_id)
          OR (m.user_b = auth.uid() AND m.user_a = rated_id))
    )
  );

CREATE OR REPLACE FUNCTION public.apply_rating_to_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
  SET rating_count = rating_count + 1,
      avg_rating = ROUND(((avg_rating * rating_count) + NEW.score)::numeric / (rating_count + 1), 2),
      swap_count = swap_count + 1,
      karma = karma + (CASE WHEN NEW.score >= 4 THEN 10 WHEN NEW.score = 3 THEN 5 ELSE 0 END)
  WHERE id = NEW.rated_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS user_ratings_apply ON public.user_ratings;
CREATE TRIGGER user_ratings_apply
  AFTER INSERT ON public.user_ratings
  FOR EACH ROW EXECUTE FUNCTION public.apply_rating_to_profile();