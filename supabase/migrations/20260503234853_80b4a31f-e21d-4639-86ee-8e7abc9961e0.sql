
-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.sticker_status AS ENUM ('need','duplicate');
CREATE TYPE public.swipe_dir AS ENUM ('like','dislike');
CREATE TYPE public.app_role AS ENUM ('admin','user');

-- =========================
-- PROFILES
-- =========================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Collector',
  bio TEXT DEFAULT '',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  is_pro BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles readable by all authenticated"
  ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile"
  ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "users insert own profile"
  ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- =========================
-- USER ROLES
-- =========================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role=_role);
$$;

CREATE POLICY "users see own roles"
  ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- =========================
-- STICKERS (master list)
-- =========================
CREATE TABLE public.stickers (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  nation TEXT NOT NULL,
  slot_type TEXT NOT NULL,
  slot_num INTEGER NOT NULL
);
ALTER TABLE public.stickers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "stickers public read"
  ON public.stickers FOR SELECT TO authenticated USING (true);

-- =========================
-- USER_STICKERS
-- =========================
CREATE TABLE public.user_stickers (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sticker_id INTEGER NOT NULL REFERENCES public.stickers(id) ON DELETE CASCADE,
  status sticker_status NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, sticker_id)
);
ALTER TABLE public.user_stickers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_us_status ON public.user_stickers(status, sticker_id);
CREATE INDEX idx_us_user ON public.user_stickers(user_id);

CREATE POLICY "users read all user_stickers"
  ON public.user_stickers FOR SELECT TO authenticated USING (true);
CREATE POLICY "users manage own user_stickers ins"
  ON public.user_stickers FOR INSERT TO authenticated WITH CHECK (auth.uid()=user_id);
CREATE POLICY "users manage own user_stickers upd"
  ON public.user_stickers FOR UPDATE TO authenticated USING (auth.uid()=user_id);
CREATE POLICY "users manage own user_stickers del"
  ON public.user_stickers FOR DELETE TO authenticated USING (auth.uid()=user_id);

-- =========================
-- SWIPES
-- =========================
CREATE TABLE public.swipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction swipe_dir NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(sender_id, receiver_id)
);
ALTER TABLE public.swipes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_swipes_sender ON public.swipes(sender_id);
CREATE INDEX idx_swipes_receiver ON public.swipes(receiver_id);

CREATE POLICY "users see swipes involving them"
  ON public.swipes FOR SELECT TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);
CREATE POLICY "users insert own swipes"
  ON public.swipes FOR INSERT TO authenticated WITH CHECK (auth.uid()=sender_id);

-- =========================
-- MATCHES
-- =========================
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_a, user_b),
  CHECK (user_a < user_b)
);
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_matches_a ON public.matches(user_a);
CREATE INDEX idx_matches_b ON public.matches(user_b);

CREATE POLICY "users see own matches"
  ON public.matches FOR SELECT TO authenticated
  USING (auth.uid()=user_a OR auth.uid()=user_b);

-- =========================
-- MESSAGES
-- =========================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_messages_match ON public.messages(match_id, created_at);

CREATE POLICY "users read messages in their matches"
  ON public.messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.id = match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
  ));
CREATE POLICY "users send messages in their matches"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
    )
  );

ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.matches REPLICA IDENTITY FULL;

-- =========================
-- DAILY SWIPE COUNT
-- =========================
CREATE TABLE public.daily_swipes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);
ALTER TABLE public.daily_swipes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own swipe count"
  ON public.daily_swipes FOR SELECT TO authenticated USING (auth.uid()=user_id);

-- =========================
-- TRIGGER: create profile on signup
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email,'@',1), 'Collector'));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- updated_at trigger helper
-- =========================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER profiles_touch BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER user_stickers_touch BEFORE UPDATE ON public.user_stickers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- =========================
-- SEED STICKERS (980 = 48 nations × 20 + 20 extras)
-- =========================
WITH nations(idx, code) AS (
  VALUES
  (1,'ARG'),(2,'AUS'),(3,'AUT'),(4,'BEL'),(5,'BRA'),(6,'CAN'),(7,'CIV'),(8,'COL'),
  (9,'CRC'),(10,'CRO'),(11,'DEN'),(12,'ECU'),(13,'EGY'),(14,'ENG'),(15,'ESP'),(16,'FRA'),
  (17,'GER'),(18,'GHA'),(19,'IRN'),(20,'ITA'),(21,'JPN'),(22,'KOR'),(23,'KSA'),(24,'MAR'),
  (25,'MEX'),(26,'NED'),(27,'NGA'),(28,'NOR'),(29,'NZL'),(30,'PAN'),(31,'PAR'),(32,'PER'),
  (33,'POL'),(34,'POR'),(35,'QAT'),(36,'RSA'),(37,'SCO'),(38,'SEN'),(39,'SRB'),(40,'SUI'),
  (41,'SWE'),(42,'TUN'),(43,'TUR'),(44,'UKR'),(45,'URU'),(46,'USA'),(47,'VEN'),(48,'WAL')
),
nation_cards AS (
  SELECT
    ((n.idx-1)*20 + s) AS id,
    n.code || ' ' || lpad(s::text,2,'0') AS code,
    n.code AS nation,
    CASE WHEN s=1 THEN 'badge' WHEN s=2 THEN 'team' ELSE 'player' END AS slot_type,
    s AS slot_num
  FROM nations n, generate_series(1,20) s
),
extras AS (
  SELECT 960+i AS id,
    CASE
      WHEN i<=10 THEN 'LEG ' || lpad(i::text,2,'0')
      WHEN i<=16 THEN 'STA ' || lpad((i-10)::text,2,'0')
      ELSE 'TRO ' || lpad((i-16)::text,2,'0')
    END AS code,
    CASE WHEN i<=10 THEN 'LEG' WHEN i<=16 THEN 'STA' ELSE 'TRO' END AS nation,
    CASE WHEN i<=10 THEN 'legend' WHEN i<=16 THEN 'stadium' ELSE 'trophy' END AS slot_type,
    i AS slot_num
  FROM generate_series(1,20) i
)
INSERT INTO public.stickers (id, code, nation, slot_type, slot_num)
SELECT * FROM nation_cards
UNION ALL SELECT * FROM extras;

-- =========================
-- RPC: get_potential_matches
-- =========================
CREATE OR REPLACE FUNCTION public.get_potential_matches(_limit INT DEFAULT 20)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  bio TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  is_pro BOOLEAN,
  receive_count BIGINT,
  give_count BIGINT,
  receive_ids INT[],
  give_ids INT[]
)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (
    SELECT auth.uid() AS uid
  ),
  my_needs AS (
    SELECT sticker_id FROM public.user_stickers WHERE user_id=(SELECT uid FROM me) AND status='need'
  ),
  my_dups AS (
    SELECT sticker_id FROM public.user_stickers WHERE user_id=(SELECT uid FROM me) AND status='duplicate'
  ),
  candidates AS (
    SELECT p.id FROM public.profiles p
    WHERE p.id <> (SELECT uid FROM me)
      AND NOT EXISTS (
        SELECT 1 FROM public.swipes s WHERE s.sender_id=(SELECT uid FROM me) AND s.receiver_id=p.id
      )
  ),
  receive AS (
    SELECT us.user_id, array_agg(us.sticker_id) AS ids, count(*) AS cnt
    FROM public.user_stickers us
    JOIN candidates c ON c.id = us.user_id
    JOIN my_needs n ON n.sticker_id = us.sticker_id
    WHERE us.status='duplicate'
    GROUP BY us.user_id
  ),
  give AS (
    SELECT us.user_id, array_agg(us.sticker_id) AS ids, count(*) AS cnt
    FROM public.user_stickers us
    JOIN candidates c ON c.id = us.user_id
    JOIN my_dups d ON d.sticker_id = us.sticker_id
    WHERE us.status='need'
    GROUP BY us.user_id
  )
  SELECT
    p.id, p.display_name, p.bio, p.lat, p.lng, p.is_pro,
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

-- =========================
-- RPC: record_swipe (handles daily limit + match creation)
-- =========================
CREATE OR REPLACE FUNCTION public.record_swipe(_receiver UUID, _direction swipe_dir)
RETURNS TABLE (matched BOOLEAN, match_id UUID, remaining INT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me UUID := auth.uid();
  _is_pro BOOLEAN;
  _today_count INT;
  _max INT := 20;
  _new_match_id UUID;
  _is_match BOOLEAN := FALSE;
  _a UUID; _b UUID;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'unauth'; END IF;
  SELECT is_pro INTO _is_pro FROM public.profiles WHERE id=_me;

  INSERT INTO public.daily_swipes(user_id, day, count)
    VALUES (_me, CURRENT_DATE, 0)
    ON CONFLICT (user_id, day) DO NOTHING;
  SELECT count INTO _today_count FROM public.daily_swipes WHERE user_id=_me AND day=CURRENT_DATE;

  IF NOT COALESCE(_is_pro,false) AND _today_count >= _max THEN
    RAISE EXCEPTION 'daily_limit_reached';
  END IF;

  INSERT INTO public.swipes(sender_id, receiver_id, direction)
    VALUES (_me, _receiver, _direction)
    ON CONFLICT (sender_id, receiver_id) DO NOTHING;

  UPDATE public.daily_swipes SET count = count+1 WHERE user_id=_me AND day=CURRENT_DATE;

  IF _direction = 'like' THEN
    IF EXISTS (SELECT 1 FROM public.swipes WHERE sender_id=_receiver AND receiver_id=_me AND direction='like') THEN
      _is_match := TRUE;
      _a := LEAST(_me,_receiver); _b := GREATEST(_me,_receiver);
      INSERT INTO public.matches(user_a, user_b) VALUES (_a, _b)
        ON CONFLICT (user_a, user_b) DO UPDATE SET created_at=public.matches.created_at
        RETURNING id INTO _new_match_id;
    END IF;
  END IF;

  RETURN QUERY SELECT _is_match, _new_match_id, GREATEST(0, _max - (_today_count+1));
END;
$$;
