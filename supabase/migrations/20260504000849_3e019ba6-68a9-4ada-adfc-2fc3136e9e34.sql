
-- 1. Profiles: add username
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key ON public.profiles (lower(username)) WHERE username IS NOT NULL;

-- 2. Drop legacy user_stickers
DROP TABLE IF EXISTS public.user_stickers CASCADE;

-- 3. New inventory table
CREATE TABLE public.user_inventory (
  user_id uuid NOT NULL,
  sticker_id integer NOT NULL,
  status text NOT NULL CHECK (status IN ('owned','duplicate')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sticker_id)
);
ALTER TABLE public.user_inventory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "inventory readable by all authenticated"
  ON public.user_inventory FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own inventory"
  ON public.user_inventory FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own inventory"
  ON public.user_inventory FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "users delete own inventory"
  ON public.user_inventory FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX user_inventory_sticker_idx ON public.user_inventory(sticker_id, status);
CREATE INDEX user_inventory_user_idx ON public.user_inventory(user_id, status);

-- 4. Reseed stickers to 650
DELETE FROM public.stickers;
WITH nations(idx, code) AS (VALUES
  (1,'ARG'),(2,'AUS'),(3,'AUT'),(4,'BEL'),(5,'BRA'),(6,'CAN'),(7,'CIV'),(8,'COL'),
  (9,'CRC'),(10,'CRO'),(11,'DEN'),(12,'ECU'),(13,'EGY'),(14,'ENG'),(15,'ESP'),(16,'FRA'),
  (17,'GER'),(18,'GHA'),(19,'IRN'),(20,'ITA'),(21,'JPN'),(22,'KOR'),(23,'KSA'),(24,'MAR'),
  (25,'MEX'),(26,'NED'),(27,'NGA'),(28,'POL'),(29,'POR'),(30,'QAT'),(31,'SEN'),(32,'SUI')
)
INSERT INTO public.stickers(id, code, nation, slot_num, slot_type)
SELECT (n.idx-1)*20 + g, n.code || ' ' || lpad(g::text,2,'0'), n.code, g, 'player'
FROM nations n CROSS JOIN generate_series(1,20) g;

INSERT INTO public.stickers(id, code, nation, slot_num, slot_type)
SELECT 640 + g, 'LEG ' || lpad(g::text,2,'0'), 'LEG', g, 'legend'
FROM generate_series(1,10) g;

-- 5. Updated matching RPC using user_inventory
-- "Need" = any sticker the user has NOT marked as owned/duplicate.
CREATE OR REPLACE FUNCTION public.get_potential_matches(_limit integer DEFAULT 20)
RETURNS TABLE(user_id uuid, display_name text, bio text, lat double precision, lng double precision, is_pro boolean, receive_count bigint, give_count bigint, receive_ids integer[], give_ids integer[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  my_owned AS (
    SELECT sticker_id FROM public.user_inventory WHERE user_id=(SELECT uid FROM me)
  ),
  my_dups AS (
    SELECT sticker_id FROM public.user_inventory WHERE user_id=(SELECT uid FROM me) AND status='duplicate'
  ),
  candidates AS (
    SELECT p.id FROM public.profiles p
    WHERE p.id <> (SELECT uid FROM me)
      AND NOT EXISTS (SELECT 1 FROM public.swipes s WHERE s.sender_id=(SELECT uid FROM me) AND s.receiver_id=p.id)
  ),
  -- candidate's duplicates that I don't own
  receive AS (
    SELECT us.user_id, array_agg(us.sticker_id) AS ids, count(*) AS cnt
    FROM public.user_inventory us
    JOIN candidates c ON c.id = us.user_id
    WHERE us.status='duplicate'
      AND us.sticker_id NOT IN (SELECT sticker_id FROM my_owned)
    GROUP BY us.user_id
  ),
  -- my duplicates that the candidate doesn't have
  give AS (
    SELECT c.id AS user_id,
           array_agg(d.sticker_id) AS ids,
           count(*) AS cnt
    FROM candidates c
    CROSS JOIN my_dups d
    WHERE NOT EXISTS (
      SELECT 1 FROM public.user_inventory us2
      WHERE us2.user_id = c.id AND us2.sticker_id = d.sticker_id
    )
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
$$;
