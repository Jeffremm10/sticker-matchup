-- Track nudged users so the same person is never nudged twice
CREATE TABLE IF NOT EXISTS public.nudge_history (
  nudger_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  nudged_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (nudger_id, nudged_id)
);
ALTER TABLE public.nudge_history ENABLE ROW LEVEL SECURITY;

-- Updated consume_nudge: excludes previously nudged users, records history,
-- and returns receive_ids/give_ids so the frontend can build the deck card
CREATE OR REPLACE FUNCTION public.consume_nudge()
RETURNS TABLE(
  user_id uuid, display_name text, bio text,
  receive_count bigint, give_count bigint,
  receive_ids int[], give_ids int[],
  distance_km int, remaining int,
  lat numeric, lng numeric, is_pro boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _me        uuid := auth.uid();
  _remaining int;
  _nudged_id uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'unauth'; END IF;

  UPDATE public.profiles p2
    SET nudge_count = p2.nudge_count - 1
    WHERE p2.id = _me AND p2.nudge_count > 0
    RETURNING p2.nudge_count INTO _remaining;
  IF _remaining IS NULL THEN RAISE EXCEPTION 'no_nudges'; END IF;

  -- Pick best candidate (exclude swiped AND previously nudged)
  WITH me_loc AS (
    SELECT p.lat AS mlat, p.lng AS mlng FROM public.profiles p WHERE p.id = _me
  ),
  my_stickers AS (
    SELECT sticker_id FROM public.user_inventory WHERE user_id = _me
  ),
  candidates AS (
    SELECT p.id AS cid, p.lat AS clat, p.lng AS clng
    FROM public.profiles p
    WHERE p.id <> _me
      AND NOT EXISTS (SELECT 1 FROM public.swipes s       WHERE s.sender_id  = _me AND s.receiver_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.nudge_history h WHERE h.nudger_id = _me AND h.nudged_id   = p.id)
  ),
  scored AS (
    SELECT c.cid,
      COUNT(inv2.sticker_id)::bigint AS rcv_count,
      ROUND(6371 * 2 * asin(sqrt(
        pow(sin(radians((c.clat - me_loc.mlat) / 2)), 2) +
        cos(radians(me_loc.mlat)) * cos(radians(c.clat)) *
        pow(sin(radians((c.clng - me_loc.mlng) / 2)), 2)
      )))::int AS dist_km
    FROM candidates c JOIN me_loc ON true
    LEFT JOIN public.user_inventory inv2 ON inv2.user_id = c.cid
      AND inv2.sticker_id IN (SELECT sticker_id FROM my_stickers)
    GROUP BY c.cid, c.clat, c.clng, me_loc.mlat, me_loc.mlng
    ORDER BY rcv_count DESC, dist_km ASC
    LIMIT 1
  )
  SELECT cid INTO _nudged_id FROM scored;

  IF _nudged_id IS NULL THEN RETURN; END IF;

  -- Record so this person is never nudged again
  INSERT INTO public.nudge_history(nudger_id, nudged_id)
    VALUES (_me, _nudged_id) ON CONFLICT DO NOTHING;

  -- Return full card data so frontend can build the deck card
  RETURN QUERY
  WITH me_loc AS (
    SELECT p.lat AS mlat, p.lng AS mlng FROM public.profiles p WHERE p.id = _me
  ),
  my_stickers AS (
    SELECT sticker_id FROM public.user_inventory WHERE user_id = _me
  ),
  their_stickers AS (
    SELECT sticker_id FROM public.user_inventory WHERE user_id = _nudged_id
  )
  SELECT
    p.id,
    p.display_name,
    p.bio,
    (SELECT COUNT(*) FROM their_stickers ts WHERE ts.sticker_id IN (SELECT sticker_id FROM my_stickers))::bigint,
    (SELECT COUNT(*) FROM my_stickers ms WHERE ms.sticker_id IN (SELECT sticker_id FROM their_stickers))::bigint,
    (SELECT array_agg(sticker_id) FROM their_stickers WHERE sticker_id IN (SELECT sticker_id FROM my_stickers)),
    (SELECT array_agg(sticker_id) FROM my_stickers WHERE sticker_id IN (SELECT sticker_id FROM their_stickers)),
    ROUND(6371 * 2 * asin(sqrt(
      pow(sin(radians((p.lat - me_loc.mlat) / 2)), 2) +
      cos(radians(me_loc.mlat)) * cos(radians(p.lat)) *
      pow(sin(radians((p.lng - me_loc.mlng) / 2)), 2)
    )))::int,
    _remaining,
    p.lat,
    p.lng,
    p.is_pro
  FROM public.profiles p JOIN me_loc ON true
  WHERE p.id = _nudged_id;
END;
$$;
