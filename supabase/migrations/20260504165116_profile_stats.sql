-- Denormalized stats on profiles for fast swipe-card rendering
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS swap_count   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avg_rating   NUMERIC(3,2) NOT NULL DEFAULT 0;

-- Trigger: increment swap_count for both users when a swap completes
CREATE OR REPLACE FUNCTION public.handle_swap_completed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _m public.matches;
BEGIN
  IF NEW.completed = TRUE AND (OLD.completed IS DISTINCT FROM TRUE) THEN
    SELECT * INTO _m FROM public.matches WHERE id = NEW.match_id;
    IF FOUND THEN
      UPDATE public.profiles SET swap_count = swap_count + 1
      WHERE id IN (_m.user_a, _m.user_b);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_swap_completed ON public.swap_sessions;
CREATE TRIGGER on_swap_completed
  AFTER UPDATE ON public.swap_sessions
  FOR EACH ROW EXECUTE FUNCTION public.handle_swap_completed();

-- Trigger: update rolling avg_rating when a rating is inserted
CREATE OR REPLACE FUNCTION public.handle_rating_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET
    avg_rating   = (avg_rating * rating_count + NEW.score) / (rating_count + 1),
    rating_count = rating_count + 1,
    karma        = CASE WHEN NEW.score = 5 THEN karma + 1 ELSE karma END
  WHERE id = NEW.rated_id;
  RETURN NEW;
END;
$$;

-- Replace the old karma-only rating trigger
DROP TRIGGER IF EXISTS on_rating_insert ON public.user_ratings;
CREATE TRIGGER on_rating_insert
  AFTER INSERT ON public.user_ratings
  FOR EACH ROW EXECUTE FUNCTION public.handle_rating_insert();

-- Update get_potential_matches to include stats
CREATE OR REPLACE FUNCTION public.get_potential_matches(_limit integer DEFAULT 20, _max_km integer DEFAULT NULL)
RETURNS TABLE(
  user_id uuid, display_name text, bio text, lat double precision, lng double precision,
  is_pro boolean, receive_count bigint, give_count bigint, receive_ids integer[], give_ids integer[],
  swap_count integer, avg_rating numeric, rating_count integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
  WITH me AS (SELECT id AS uid, lat AS mlat, lng AS mlng FROM public.profiles WHERE id = auth.uid()),
  my_owned AS (SELECT sticker_id FROM public.user_inventory WHERE user_id=(SELECT uid FROM me)),
  my_dups  AS (SELECT sticker_id FROM public.user_inventory WHERE user_id=(SELECT uid FROM me) AND status='duplicate'),
  candidates AS (
    SELECT p.id FROM public.profiles p
    WHERE p.id <> (SELECT uid FROM me)
      AND NOT EXISTS (SELECT 1 FROM public.swipes s WHERE s.sender_id=(SELECT uid FROM me) AND s.receiver_id=p.id)
      AND (
        _max_km IS NULL
        OR (SELECT mlat FROM me) IS NULL OR (SELECT mlng FROM me) IS NULL OR p.lat IS NULL OR p.lng IS NULL
        OR (6371 * 2 * asin(sqrt(
            power(sin(radians((p.lat-(SELECT mlat FROM me))/2)),2) +
            cos(radians((SELECT mlat FROM me)))*cos(radians(p.lat))*
            power(sin(radians((p.lng-(SELECT mlng FROM me))/2)),2)
          ))) <= _max_km
      )
  ),
  receive AS (
    SELECT us.user_id, array_agg(us.sticker_id) AS ids, count(*) AS cnt
    FROM public.user_inventory us JOIN candidates c ON c.id=us.user_id
    WHERE us.status='duplicate' AND us.sticker_id NOT IN (SELECT sticker_id FROM my_owned)
    GROUP BY us.user_id
  ),
  give AS (
    SELECT c.id AS user_id, array_agg(d.sticker_id) AS ids, count(*) AS cnt
    FROM candidates c CROSS JOIN my_dups d
    WHERE NOT EXISTS (SELECT 1 FROM public.user_inventory us2 WHERE us2.user_id=c.id AND us2.sticker_id=d.sticker_id)
    GROUP BY c.id
  )
  SELECT p.id, p.display_name, p.bio, p.lat, p.lng, p.is_pro,
    COALESCE(r.cnt,0), COALESCE(g.cnt,0),
    COALESCE(r.ids,'{}'), COALESCE(g.ids,'{}'),
    p.swap_count, p.avg_rating, p.rating_count
  FROM candidates c
  JOIN public.profiles p ON p.id=c.id
  LEFT JOIN receive r ON r.user_id=c.id
  LEFT JOIN give    g ON g.user_id=c.id
  WHERE COALESCE(r.cnt,0)+COALESCE(g.cnt,0) > 0
  ORDER BY (p.karma * 2 + COALESCE(r.cnt,0)+COALESCE(g.cnt,0)) DESC
  LIMIT _limit;
$function$;
