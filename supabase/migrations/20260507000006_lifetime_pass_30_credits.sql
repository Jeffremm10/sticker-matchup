-- Remove unlimited bypass from consume_nudge — pro users now use their count like everyone else
CREATE OR REPLACE FUNCTION public.consume_nudge()
RETURNS TABLE(user_id uuid, display_name text, receive_count bigint, distance_km int, remaining int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _me        uuid    := auth.uid();
  _remaining int;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'unauth'; END IF;

  UPDATE public.profiles p2
    SET nudge_count = p2.nudge_count - 1
    WHERE p2.id = _me AND p2.nudge_count > 0
    RETURNING p2.nudge_count INTO _remaining;
  IF _remaining IS NULL THEN RAISE EXCEPTION 'no_nudges'; END IF;

  RETURN QUERY
  WITH me_loc AS (
    SELECT p.id AS uid, p.lat AS mlat, p.lng AS mlng
    FROM public.profiles p WHERE p.id = _me
  ),
  my_owned AS (
    SELECT inv.sticker_id FROM public.user_inventory inv WHERE inv.user_id = _me
  ),
  candidates AS (
    SELECT p.id AS cid, p.display_name AS cname, p.lat AS clat, p.lng AS clng
    FROM public.profiles p
    WHERE p.id <> _me
      AND NOT EXISTS (SELECT 1 FROM public.swipes s WHERE s.sender_id = _me AND s.receiver_id = p.id)
  ),
  scored AS (
    SELECT c.cid, c.cname,
      COUNT(inv2.sticker_id)::bigint AS rcv_count,
      ROUND(6371 * 2 * asin(sqrt(
        pow(sin(radians((c.clat - me_loc.mlat) / 2)), 2) +
        cos(radians(me_loc.mlat)) * cos(radians(c.clat)) *
        pow(sin(radians((c.clng - me_loc.mlng) / 2)), 2)
      )))::int AS dist_km
    FROM candidates c JOIN me_loc ON true
    LEFT JOIN public.user_inventory inv2
      ON inv2.user_id = c.cid AND inv2.sticker_id IN (SELECT mo.sticker_id FROM my_owned mo)
    GROUP BY c.cid, c.cname, c.clat, c.clng, me_loc.mlat, me_loc.mlng
    ORDER BY rcv_count DESC, dist_km ASC LIMIT 1
  )
  SELECT s.cid, s.cname, s.rcv_count, s.dist_km, _remaining FROM scored s;
END;
$$;

-- Remove unlimited bypass from send_super_swap
CREATE OR REPLACE FUNCTION public.send_super_swap(_receiver uuid, _body text)
RETURNS TABLE(remaining int, message_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _remaining int;
  _msg_id uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'unauth'; END IF;
  IF _body IS NULL OR length(trim(_body)) = 0 THEN RAISE EXCEPTION 'empty_body'; END IF;
  IF _me = _receiver THEN RAISE EXCEPTION 'self_send'; END IF;

  UPDATE public.profiles
    SET super_swap_count = super_swap_count - 1
    WHERE id = _me AND super_swap_count > 0
    RETURNING super_swap_count INTO _remaining;
  IF _remaining IS NULL THEN RAISE EXCEPTION 'no_super_swaps'; END IF;

  INSERT INTO public.super_swap_messages(sender_id, receiver_id, body)
    VALUES (_me, _receiver, _body) RETURNING id INTO _msg_id;

  RETURN QUERY SELECT _remaining, _msg_id;
END; $$;
