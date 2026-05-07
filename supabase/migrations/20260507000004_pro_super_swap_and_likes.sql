-- Fix send_super_swap: bypass count for pro users
CREATE OR REPLACE FUNCTION public.send_super_swap(_receiver uuid, _body text)
RETURNS TABLE(remaining int, message_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _remaining int;
  _msg_id uuid;
  _is_pro boolean;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'unauth'; END IF;
  IF _body IS NULL OR length(trim(_body)) = 0 THEN RAISE EXCEPTION 'empty_body'; END IF;
  IF _me = _receiver THEN RAISE EXCEPTION 'self_send'; END IF;

  SELECT p.is_pro INTO _is_pro FROM public.profiles p WHERE p.id = _me;

  IF COALESCE(_is_pro, false) THEN
    _remaining := 999;
  ELSE
    UPDATE public.profiles
      SET super_swap_count = super_swap_count - 1
      WHERE id = _me AND super_swap_count > 0
      RETURNING super_swap_count INTO _remaining;
    IF _remaining IS NULL THEN RAISE EXCEPTION 'no_super_swaps'; END IF;
  END IF;

  INSERT INTO public.super_swap_messages(sender_id, receiver_id, body)
    VALUES (_me, _receiver, _body) RETURNING id INTO _msg_id;

  RETURN QUERY SELECT _remaining, _msg_id;
END; $$;

-- Fix get_likes_received: expose real identity to pro users
CREATE OR REPLACE FUNCTION public.get_likes_received()
RETURNS TABLE(
  anon_id text,
  real_user_id uuid,
  display_name text,
  distance_km integer,
  is_pro boolean,
  receive_count bigint,
  give_count bigint,
  receive_ids integer[],
  give_ids integer[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  WITH viewer AS (
    SELECT id AS uid, lat AS mlat, lng AS mlng, is_pro AS viewer_pro
    FROM public.profiles WHERE id = auth.uid()
  ),
  my_owned AS (SELECT sticker_id FROM public.user_inventory WHERE user_id=(SELECT uid FROM viewer)),
  my_dups  AS (SELECT sticker_id FROM public.user_inventory WHERE user_id=(SELECT uid FROM viewer) AND status='duplicate'),
  likers AS (
    SELECT s.sender_id AS uid FROM public.swipes s
    WHERE s.receiver_id=(SELECT uid FROM viewer) AND s.direction='like'
      AND NOT EXISTS (
        SELECT 1 FROM public.swipes s2
        WHERE s2.sender_id=(SELECT uid FROM viewer) AND s2.receiver_id=s.sender_id
      )
  ),
  receive AS (
    SELECT us.user_id, array_agg(us.sticker_id) AS ids, count(*) AS cnt
    FROM public.user_inventory us JOIN likers l ON l.uid=us.user_id
    WHERE us.status='duplicate' AND us.sticker_id NOT IN (SELECT sticker_id FROM my_owned)
    GROUP BY us.user_id
  ),
  give AS (
    SELECT l.uid AS user_id, array_agg(d.sticker_id) AS ids, count(*) AS cnt
    FROM likers l CROSS JOIN my_dups d
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_inventory us2
      WHERE us2.user_id=l.uid AND us2.sticker_id=d.sticker_id
    )
    GROUP BY l.uid
  )
  SELECT
    md5(l.uid::text || (SELECT uid FROM viewer)::text) AS anon_id,
    CASE WHEN (SELECT viewer_pro FROM viewer) THEN l.uid ELSE NULL END AS real_user_id,
    CASE WHEN (SELECT viewer_pro FROM viewer) THEN p.display_name ELSE NULL END AS display_name,
    CASE
      WHEN p.lat IS NULL OR (SELECT mlat FROM viewer) IS NULL THEN NULL
      ELSE (6371 * 2 * asin(sqrt(
        power(sin(radians((p.lat-(SELECT mlat FROM viewer))/2)),2) +
        cos(radians((SELECT mlat FROM viewer)))*cos(radians(p.lat))*
        power(sin(radians((p.lng-(SELECT mlng FROM viewer))/2)),2)
      )))::int
    END AS distance_km,
    p.is_pro,
    COALESCE(r.cnt,0),
    COALESCE(g.cnt,0),
    COALESCE(r.ids,'{}'),
    COALESCE(g.ids,'{}')
  FROM likers l
  JOIN public.profiles p ON p.id=l.uid
  LEFT JOIN receive r ON r.user_id=l.uid
  LEFT JOIN give g ON g.user_id=l.uid
$function$;
