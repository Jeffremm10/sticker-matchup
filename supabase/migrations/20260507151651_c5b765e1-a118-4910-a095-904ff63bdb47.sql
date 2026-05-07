CREATE OR REPLACE FUNCTION public.consume_nudge()
RETURNS TABLE(user_id uuid, display_name text, receive_count bigint, distance_km int, remaining int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _me        uuid    := auth.uid();
  _remaining int;
  _is_pro    boolean;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'unauth'; END IF;

  SELECT p.is_pro INTO _is_pro FROM public.profiles p WHERE p.id = _me;

  IF COALESCE(_is_pro, false) THEN
    _remaining := 999;
  ELSE
    UPDATE public.profiles p2
      SET nudge_count = p2.nudge_count - 1
      WHERE p2.id = _me AND p2.nudge_count > 0
      RETURNING p2.nudge_count INTO _remaining;
    IF _remaining IS NULL THEN RAISE EXCEPTION 'no_nudges'; END IF;
  END IF;

  RETURN QUERY
  WITH me_loc AS (
    SELECT p.id AS uid, p.lat AS mlat, p.lng AS mlng
    FROM public.profiles p WHERE p.id = _me
  ),
  my_owned AS (
    SELECT inv.sticker_id
    FROM public.user_inventory inv
    WHERE inv.user_id = _me
  ),
  candidates AS (
    SELECT p.id AS cid, p.display_name AS cname, p.lat AS clat, p.lng AS clng
    FROM public.profiles p
    WHERE p.id <> _me
      AND NOT EXISTS (
        SELECT 1 FROM public.swipes s
        WHERE s.sender_id = _me AND s.receiver_id = p.id
      )
  ),
  scored AS (
    SELECT
      c.cid,
      c.cname,
      COUNT(inv2.sticker_id)::bigint AS rcv_count,
      ROUND(earth_distance(
        ll_to_earth(me_loc.mlat, me_loc.mlng),
        ll_to_earth(c.clat, c.clng)
      ) / 1000)::int AS dist_km
    FROM candidates c
    JOIN me_loc ON true
    LEFT JOIN public.user_inventory inv2
      ON inv2.user_id = c.cid
      AND inv2.sticker_id IN (SELECT mo.sticker_id FROM my_owned mo)
    GROUP BY c.cid, c.cname, c.clat, c.clng, me_loc.mlat, me_loc.mlng
    ORDER BY rcv_count DESC, dist_km ASC
    LIMIT 1
  )
  SELECT s.cid, s.cname, s.rcv_count, s.dist_km, _remaining
  FROM scored s;
END;
$$;