-- ── profiles: emergency contact ────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_contact TEXT;

-- ── meetup_slots ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.meetup_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  venue_name TEXT NOT NULL,
  venue_address TEXT,
  venue_lat DOUBLE PRECISION,
  venue_lng DOUBLE PRECISION,
  scheduled_at TIMESTAMPTZ NOT NULL,
  suggested_by UUID NOT NULL,
  confirmed_by UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.meetup_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match members read meetup_slots" ON public.meetup_slots FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())));
CREATE POLICY "match members insert meetup_slots" ON public.meetup_slots FOR INSERT TO authenticated
WITH CHECK (auth.uid() = suggested_by AND EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())));
CREATE POLICY "match members update meetup_slots" ON public.meetup_slots FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())));

ALTER PUBLICATION supabase_realtime ADD TABLE public.meetup_slots;

-- ── swap_sessions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.swap_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID UNIQUE REFERENCES public.matches(id) ON DELETE CASCADE,
  trade_id UUID,
  pin TEXT NOT NULL DEFAULT '',
  heading_a BOOLEAN NOT NULL DEFAULT false,
  heading_b BOOLEAN NOT NULL DEFAULT false,
  arrived_a BOOLEAN NOT NULL DEFAULT false,
  arrived_b BOOLEAN NOT NULL DEFAULT false,
  complete_a BOOLEAN NOT NULL DEFAULT false,
  complete_b BOOLEAN NOT NULL DEFAULT false,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.swap_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match members read swap_sessions" ON public.swap_sessions FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())));
CREATE POLICY "match members insert swap_sessions" ON public.swap_sessions FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())));
CREATE POLICY "match members update swap_sessions" ON public.swap_sessions FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())));

ALTER PUBLICATION supabase_realtime ADD TABLE public.swap_sessions;

-- ── trade_proposals ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.trade_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  proposer_id UUID NOT NULL,
  give_ids INTEGER[] NOT NULL DEFAULT '{}',
  receive_ids INTEGER[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trade_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "match members read trade_proposals" ON public.trade_proposals FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())));
CREATE POLICY "match members insert trade_proposals" ON public.trade_proposals FOR INSERT TO authenticated
WITH CHECK (auth.uid() = proposer_id AND EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())));
CREATE POLICY "match members update trade_proposals" ON public.trade_proposals FOR UPDATE TO authenticated
USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id = match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())));

-- ── venues ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  address TEXT,
  osm_id TEXT UNIQUE,
  nominations INTEGER NOT NULL DEFAULT 0,
  swap_count INTEGER NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venues readable by all authenticated" ON public.venues FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated can insert venues" ON public.venues FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated can update venues" ON public.venues FOR UPDATE TO authenticated USING (true);

-- ── venue_nominations ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.venue_nominations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, venue_id)
);
ALTER TABLE public.venue_nominations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nominations readable" ON public.venue_nominations FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own nominations" ON public.venue_nominations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Trigger to bump nomination count and verify after 5 votes
CREATE OR REPLACE FUNCTION public.bump_venue_nominations()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.venues
  SET nominations = nominations + 1,
      is_verified = (nominations + 1) >= 5
  WHERE id = NEW.venue_id;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_bump_venue_nominations ON public.venue_nominations;
CREATE TRIGGER trg_bump_venue_nominations AFTER INSERT ON public.venue_nominations
FOR EACH ROW EXECUTE FUNCTION public.bump_venue_nominations();

-- ── check_ins ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  emergency_contact TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ
);
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "check_ins readable by all authenticated" ON public.check_ins FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own check_ins" ON public.check_ins FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own check_ins" ON public.check_ins FOR UPDATE TO authenticated USING (auth.uid() = user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.check_ins;

-- ── RPC: get_match_compatibility ───────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_match_compatibility(_match_id UUID)
RETURNS TABLE(give_count BIGINT, receive_count BIGINT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _me UUID := auth.uid(); _other UUID;
BEGIN
  SELECT CASE WHEN m.user_a = _me THEN m.user_b ELSE m.user_a END INTO _other
  FROM public.matches m WHERE m.id = _match_id AND (m.user_a = _me OR m.user_b = _me);
  IF _other IS NULL THEN RAISE EXCEPTION 'not a match member'; END IF;

  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.user_inventory mine
       WHERE mine.user_id = _me AND mine.status = 'duplicate'
       AND NOT EXISTS (SELECT 1 FROM public.user_inventory th WHERE th.user_id = _other AND th.sticker_id = mine.sticker_id)),
    (SELECT count(*) FROM public.user_inventory th
       WHERE th.user_id = _other AND th.status = 'duplicate'
       AND NOT EXISTS (SELECT 1 FROM public.user_inventory mine WHERE mine.user_id = _me AND mine.sticker_id = th.sticker_id));
END; $$;

-- ── RPC: confirm_swap ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.confirm_swap(_match_id UUID, _is_user_a BOOLEAN)
RETURNS TABLE(completed BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _done BOOLEAN := false;
BEGIN
  IF _is_user_a THEN
    UPDATE public.swap_sessions SET complete_a = true WHERE match_id = _match_id;
  ELSE
    UPDATE public.swap_sessions SET complete_b = true WHERE match_id = _match_id;
  END IF;

  UPDATE public.swap_sessions
    SET completed = (complete_a AND complete_b)
    WHERE match_id = _match_id
    RETURNING completed INTO _done;

  RETURN QUERY SELECT COALESCE(_done, false);
END; $$;

-- ── RPC: upsert_osm_venue ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.upsert_osm_venue(
  _name TEXT, _type TEXT, _lat DOUBLE PRECISION, _lng DOUBLE PRECISION, _address TEXT, _osm_id TEXT
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id UUID;
BEGIN
  INSERT INTO public.venues(name, type, lat, lng, address, osm_id, is_verified)
  VALUES (_name, _type, _lat, _lng, _address, _osm_id, true)
  ON CONFLICT (osm_id) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address
  RETURNING id INTO _id;
  RETURN _id;
END; $$;