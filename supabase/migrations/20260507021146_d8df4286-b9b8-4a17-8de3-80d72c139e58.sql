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
      (SELECT count(*) FROM public.user_inventory us
        WHERE us.user_id=c.id AND us.status='duplicate'
        AND us.sticker_id NOT IN (SELECT sticker_id FROM my_owned)) AS cnt
    FROM candidates c
  )
  SELECT s.id, s.display_name, s.cnt,
    CASE WHEN s.lat IS NULL OR (SELECT mlat FROM me) IS NULL THEN NULL
      ELSE (6371*2*asin(sqrt(
        power(sin(radians((s.lat-(SELECT mlat FROM me))/2)),2) +
        cos(radians((SELECT mlat FROM me)))*cos(radians(s.lat))*
        power(sin(radians((s.lng-(SELECT mlng FROM me))/2)),2)
      )))::int END,
    _remaining
  FROM scored s
  WHERE s.cnt >= 5
  ORDER BY s.cnt DESC NULLS LAST
  LIMIT 1;
END;
$$;