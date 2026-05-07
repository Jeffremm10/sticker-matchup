CREATE OR REPLACE FUNCTION public.consume_nudge()
RETURNS TABLE(user_id uuid, display_name text, receive_count bigint, distance_km int, remaining int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _remaining int;
  _is_pro boolean;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'unauth'; END IF;

  SELECT is_pro INTO _is_pro FROM public.profiles WHERE id = _me;

  IF COALESCE(_is_pro, false) THEN
    -- Pro users: don't consume a nudge, use unlimited
    _remaining := 999;
  ELSE
    UPDATE public.profiles SET nudge_count = nudge_count - 1
      WHERE id = _me AND nudge_count > 0
      RETURNING nudge_count INTO _remaining;
    IF _remaining IS NULL THEN RAISE EXCEPTION 'no_nudges'; END IF;
  END IF;

  RETURN QUERY
  WITH me AS (SELECT id AS uid, lat AS mlat, lng AS mlng FROM public.profiles WHERE id = _me),
  my_owned AS (SELECT sticker_id FROM public.user_inventory WHERE user_id=_me),
  candidates AS (
    SELECT p.id, p.display_name, p.lat, p.lng FROM public.profiles p
    WHERE p.id <> _me
      AND NOT EXISTS (SELECT 1 FROM public.swipes s WHERE s.sender_id=_me AND s.receiver_id=p.id)
  ),
  scored AS (
    SELECT c.id, c.display_name, c.lat, c.lng,
      COUNT(ui.sticker_id) AS receive_count,
      ROUND(
        earth_distance(ll_to_earth(me.mlat, me.mlng), ll_to_earth(c.lat, c.lng)) / 1000
      )::int AS distance_km
    FROM candidates c
    JOIN me ON true
    LEFT JOIN public.user_inventory ui
      ON ui.user_id = c.id AND ui.sticker_id IN (SELECT sticker_id FROM my_owned)
    GROUP BY c.id, c.display_name, c.lat, c.lng, me.mlat, me.mlng
    ORDER BY receive_count DESC, distance_km ASC
    LIMIT 1
  )
  SELECT s.id, s.display_name, s.receive_count, s.distance_km, _remaining
  FROM scored s;
END;
$$;
