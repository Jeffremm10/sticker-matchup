ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS swap_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS karma INTEGER NOT NULL DEFAULT 0;

DROP FUNCTION IF EXISTS public.get_potential_matches(integer, integer);
DROP FUNCTION IF EXISTS public.get_potential_matches(integer);

CREATE OR REPLACE FUNCTION public.get_potential_matches(_limit integer DEFAULT 20, _max_km integer DEFAULT NULL::integer)
 RETURNS TABLE(user_id uuid, display_name text, bio text, lat double precision, lng double precision, is_pro boolean, receive_count bigint, give_count bigint, receive_ids integer[], give_ids integer[], swap_count integer, avg_rating numeric, rating_count integer, karma integer)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH me AS (SELECT id AS uid, lat AS mlat, lng AS mlng FROM public.profiles WHERE id = auth.uid()),
  my_owned AS (SELECT sticker_id FROM public.user_inventory WHERE user_id=(SELECT uid FROM me)),
  my_dups AS (SELECT sticker_id FROM public.user_inventory WHERE user_id=(SELECT uid FROM me) AND status='duplicate'),
  candidates AS (
    SELECT p.id FROM public.profiles p
    WHERE p.id <> (SELECT uid FROM me)
      AND NOT EXISTS (SELECT 1 FROM public.swipes s WHERE s.sender_id=(SELECT uid FROM me) AND s.receiver_id=p.id)
      AND (
        _max_km IS NULL
        OR (SELECT mlat FROM me) IS NULL OR (SELECT mlng FROM me) IS NULL
        OR p.lat IS NULL OR p.lng IS NULL
        OR (6371 * 2 * asin(sqrt(
            power(sin(radians((p.lat - (SELECT mlat FROM me))/2)),2) +
            cos(radians((SELECT mlat FROM me)))*cos(radians(p.lat)) *
            power(sin(radians((p.lng - (SELECT mlng FROM me))/2)),2)
          ))) <= _max_km
      )
  ),
  receive AS (
    SELECT us.user_id, array_agg(us.sticker_id) AS ids, count(*) AS cnt
    FROM public.user_inventory us JOIN candidates c ON c.id = us.user_id
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
    COALESCE(r.ids,'{}'::int[]), COALESCE(g.ids,'{}'::int[]),
    p.swap_count, p.avg_rating, p.rating_count, p.karma
  FROM candidates c
  JOIN public.profiles p ON p.id=c.id
  LEFT JOIN receive r ON r.user_id=c.id
  LEFT JOIN give g ON g.user_id=c.id
  WHERE COALESCE(r.cnt,0)+COALESCE(g.cnt,0) > 0
  ORDER BY (COALESCE(r.cnt,0)+COALESCE(g.cnt,0)) DESC
  LIMIT _limit;
$function$;