CREATE OR REPLACE FUNCTION public.get_potential_matches(_limit integer DEFAULT 20, _max_km integer DEFAULT NULL)
 RETURNS TABLE(user_id uuid, display_name text, bio text, lat double precision, lng double precision, is_pro boolean, receive_count bigint, give_count bigint, receive_ids integer[], give_ids integer[])
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
    COALESCE(r.ids,'{}'), COALESCE(g.ids,'{}')
  FROM candidates c
  JOIN public.profiles p ON p.id=c.id
  LEFT JOIN receive r ON r.user_id=c.id
  LEFT JOIN give g ON g.user_id=c.id
  WHERE COALESCE(r.cnt,0)+COALESCE(g.cnt,0) > 0
  ORDER BY (COALESCE(r.cnt,0)+COALESCE(g.cnt,0)) DESC
  LIMIT _limit;
$function$;

CREATE OR REPLACE FUNCTION public.get_likes_received()
 RETURNS TABLE(anon_id text, distance_km integer, is_pro boolean, receive_count bigint, give_count bigint, receive_ids integer[], give_ids integer[])
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH me AS (SELECT id AS uid, lat AS mlat, lng AS mlng FROM public.profiles WHERE id = auth.uid()),
  my_owned AS (SELECT sticker_id FROM public.user_inventory WHERE user_id=(SELECT uid FROM me)),
  my_dups AS (SELECT sticker_id FROM public.user_inventory WHERE user_id=(SELECT uid FROM me) AND status='duplicate'),
  likers AS (
    SELECT s.sender_id AS uid FROM public.swipes s
    WHERE s.receiver_id=(SELECT uid FROM me) AND s.direction='like'
      AND NOT EXISTS (SELECT 1 FROM public.swipes s2 WHERE s2.sender_id=(SELECT uid FROM me) AND s2.receiver_id=s.sender_id)
  ),
  receive AS (
    SELECT us.user_id, array_agg(us.sticker_id) AS ids, count(*) AS cnt
    FROM public.user_inventory us JOIN likers l ON l.uid = us.user_id
    WHERE us.status='duplicate' AND us.sticker_id NOT IN (SELECT sticker_id FROM my_owned)
    GROUP BY us.user_id
  ),
  give AS (
    SELECT l.uid AS user_id, array_agg(d.sticker_id) AS ids, count(*) AS cnt
    FROM likers l CROSS JOIN my_dups d
    WHERE NOT EXISTS (SELECT 1 FROM public.user_inventory us2 WHERE us2.user_id=l.uid AND us2.sticker_id=d.sticker_id)
    GROUP BY l.uid
  )
  SELECT
    md5(l.uid::text || (SELECT uid FROM me)::text) AS anon_id,
    CASE
      WHEN p.lat IS NULL OR p.lng IS NULL OR (SELECT mlat FROM me) IS NULL OR (SELECT mlng FROM me) IS NULL THEN NULL
      ELSE (6371 * 2 * asin(sqrt(
        power(sin(radians((p.lat - (SELECT mlat FROM me))/2)),2) +
        cos(radians((SELECT mlat FROM me)))*cos(radians(p.lat)) *
        power(sin(radians((p.lng - (SELECT mlng FROM me))/2)),2)
      )))::int
    END AS distance_km,
    p.is_pro,
    COALESCE(r.cnt,0), COALESCE(g.cnt,0),
    COALESCE(r.ids,'{}'), COALESCE(g.ids,'{}')
  FROM likers l
  JOIN public.profiles p ON p.id=l.uid
  LEFT JOIN receive r ON r.user_id=l.uid
  LEFT JOIN give g ON g.user_id=l.uid
  ORDER BY (COALESCE(r.cnt,0)+COALESCE(g.cnt,0)) DESC;
$function$;