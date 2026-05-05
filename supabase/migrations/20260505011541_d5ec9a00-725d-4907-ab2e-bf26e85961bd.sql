
-- 1. Profile columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS super_swap_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_final_10_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS nudge_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS visibility_boost int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wishlist_count int NOT NULL DEFAULT 0;

-- 2. transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id text NOT NULL,
  platform text,
  revenuecat_event_id text UNIQUE,
  original_transaction_id text,
  price_cents int,
  currency text,
  purchased_at timestamptz NOT NULL DEFAULT now(),
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own transactions" ON public.transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3. super_swap_messages
CREATE TABLE IF NOT EXISTS public.super_swap_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  receiver_id uuid NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.super_swap_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read super_swap_messages" ON public.super_swap_messages
  FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "receiver can mark read" ON public.super_swap_messages
  FOR UPDATE TO authenticated USING (auth.uid() = receiver_id);

-- 4. send_super_swap
CREATE OR REPLACE FUNCTION public.send_super_swap(_receiver uuid, _body text)
RETURNS TABLE(remaining int, message_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _me uuid := auth.uid(); _remaining int; _msg_id uuid;
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

-- 5. consume_nudge
CREATE OR REPLACE FUNCTION public.consume_nudge()
RETURNS TABLE(user_id uuid, display_name text, receive_count bigint, distance_km int, remaining int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _me uuid := auth.uid(); _remaining int;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'unauth'; END IF;
  UPDATE public.profiles SET nudge_count = nudge_count - 1
    WHERE id = _me AND nudge_count > 0
    RETURNING nudge_count INTO _remaining;
  IF _remaining IS NULL THEN RAISE EXCEPTION 'no_nudges'; END IF;

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
END; $$;

-- 6. wishlist_count trigger (recalc owned each change)
CREATE OR REPLACE FUNCTION public.bump_wishlist_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid;
BEGIN
  _uid := COALESCE(NEW.user_id, OLD.user_id);
  UPDATE public.profiles SET wishlist_count = (
    (SELECT count(*) FROM public.stickers) -
    (SELECT count(*) FROM public.user_inventory WHERE user_id = _uid)
  ) WHERE id = _uid;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_bump_wishlist ON public.user_inventory;
CREATE TRIGGER trg_bump_wishlist
AFTER INSERT OR UPDATE OR DELETE ON public.user_inventory
FOR EACH ROW EXECUTE FUNCTION public.bump_wishlist_count();

-- 7. Updated get_potential_matches with Final 10 + ranking
DROP FUNCTION IF EXISTS public.get_potential_matches(integer, integer);
CREATE OR REPLACE FUNCTION public.get_potential_matches(
  _limit int DEFAULT 20,
  _max_km int DEFAULT NULL,
  _final_10 boolean DEFAULT false
)
RETURNS TABLE(user_id uuid, display_name text, bio text, lat double precision, lng double precision,
  is_pro boolean, receive_count bigint, give_count bigint, receive_ids int[], give_ids int[],
  swap_count int, avg_rating numeric, rating_count int, karma int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (SELECT id AS uid, lat AS mlat, lng AS mlng FROM public.profiles WHERE id = auth.uid()),
  my_owned AS (SELECT sticker_id FROM public.user_inventory WHERE user_id=(SELECT uid FROM me)),
  my_missing AS (
    SELECT s.id AS sticker_id FROM public.stickers s
    WHERE s.id NOT IN (SELECT sticker_id FROM my_owned)
  ),
  my_dups AS (SELECT sticker_id FROM public.user_inventory WHERE user_id=(SELECT uid FROM me) AND status='duplicate'),
  candidates AS (
    SELECT p.id FROM public.profiles p
    WHERE p.id <> (SELECT uid FROM me)
      AND NOT EXISTS (SELECT 1 FROM public.swipes s WHERE s.sender_id=(SELECT uid FROM me) AND s.receiver_id=p.id)
      AND (
        _max_km IS NULL OR _final_10
        OR (SELECT mlat FROM me) IS NULL OR (SELECT mlng FROM me) IS NULL
        OR p.lat IS NULL OR p.lng IS NULL
        OR (6371*2*asin(sqrt(
            power(sin(radians((p.lat - (SELECT mlat FROM me))/2)),2) +
            cos(radians((SELECT mlat FROM me)))*cos(radians(p.lat)) *
            power(sin(radians((p.lng - (SELECT mlng FROM me))/2)),2)
          ))) <= _max_km
      )
      AND (
        NOT _final_10
        OR EXISTS (
          SELECT 1 FROM public.user_inventory us
          WHERE us.user_id = p.id AND us.status='duplicate'
            AND us.sticker_id IN (SELECT sticker_id FROM my_missing)
        )
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
  ORDER BY
    (p.tier = 'premium')::int DESC,
    p.visibility_boost DESC,
    (COALESCE(r.cnt,0)+COALESCE(g.cnt,0)) DESC
  LIMIT _limit;
$$;

-- realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.super_swap_messages;
