-- ═══════════════════════════════════════════════════
-- TRADE FLOW: proposals → meetup → swap → rating
-- ═══════════════════════════════════════════════════

-- 1. Enrich messages with type + metadata
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS msg_type TEXT NOT NULL DEFAULT 'text';
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS meta JSONB;

-- 2. Trade proposals
CREATE TYPE public.trade_status AS ENUM ('pending','accepted','locked','declined');

CREATE TABLE public.trade_proposals (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  proposer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  give_ids    INTEGER[] NOT NULL DEFAULT '{}',   -- proposer gives these
  receive_ids INTEGER[] NOT NULL DEFAULT '{}',   -- proposer expects these
  status      trade_status NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.trade_proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "trade proposals readable by match members"
  ON public.trade_proposals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id=match_id AND (m.user_a=auth.uid() OR m.user_b=auth.uid())));
CREATE POLICY "users insert own proposals"
  ON public.trade_proposals FOR INSERT TO authenticated WITH CHECK (auth.uid()=proposer_id);
CREATE POLICY "match members update proposals"
  ON public.trade_proposals FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.matches m WHERE m.id=match_id AND (m.user_a=auth.uid() OR m.user_b=auth.uid())));

ALTER PUBLICATION supabase_realtime ADD TABLE public.trade_proposals;
ALTER TABLE public.trade_proposals REPLICA IDENTITY FULL;

-- 3. Meetup slots (unlocked once trade is locked)
CREATE TYPE public.meetup_status AS ENUM ('pending','confirmed','cancelled');

CREATE TABLE public.meetup_slots (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id      UUID NOT NULL REFERENCES public.trade_proposals(id) ON DELETE CASCADE,
  venue_name    TEXT NOT NULL,
  venue_address TEXT,
  venue_lat     DOUBLE PRECISION,
  venue_lng     DOUBLE PRECISION,
  scheduled_at  TIMESTAMPTZ NOT NULL,
  suggested_by  UUID NOT NULL REFERENCES auth.users(id),
  confirmed_by  UUID REFERENCES auth.users(id),
  status        meetup_status NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.meetup_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meetup slots readable by trade members"
  ON public.meetup_slots FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trade_proposals tp
    JOIN public.matches m ON m.id=tp.match_id
    WHERE tp.id=trade_id AND (m.user_a=auth.uid() OR m.user_b=auth.uid())
  ));
CREATE POLICY "users insert meetup slots"
  ON public.meetup_slots FOR INSERT TO authenticated WITH CHECK (auth.uid()=suggested_by);
CREATE POLICY "users update meetup slots"
  ON public.meetup_slots FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trade_proposals tp
    JOIN public.matches m ON m.id=tp.match_id
    WHERE tp.id=trade_id AND (m.user_a=auth.uid() OR m.user_b=auth.uid())
  ));

ALTER PUBLICATION supabase_realtime ADD TABLE public.meetup_slots;
ALTER TABLE public.meetup_slots REPLICA IDENTITY FULL;

-- 4. Swap sessions (day-of dashboard)
CREATE TABLE public.swap_sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id    UUID NOT NULL UNIQUE REFERENCES public.trade_proposals(id) ON DELETE CASCADE,
  pin         TEXT NOT NULL,                   -- 6-digit verification PIN
  heading_a   BOOLEAN NOT NULL DEFAULT FALSE,  -- user_a hit "Heading There"
  heading_b   BOOLEAN NOT NULL DEFAULT FALSE,
  arrived_a   BOOLEAN NOT NULL DEFAULT FALSE,  -- user_a hit "I'm Here"
  arrived_b   BOOLEAN NOT NULL DEFAULT FALSE,
  completed   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.swap_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "swap sessions readable by trade members"
  ON public.swap_sessions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trade_proposals tp
    JOIN public.matches m ON m.id=tp.match_id
    WHERE tp.id=trade_id AND (m.user_a=auth.uid() OR m.user_b=auth.uid())
  ));
CREATE POLICY "swap sessions updatable by trade members"
  ON public.swap_sessions FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.trade_proposals tp
    JOIN public.matches m ON m.id=tp.match_id
    WHERE tp.id=trade_id AND (m.user_a=auth.uid() OR m.user_b=auth.uid())
  ));

ALTER PUBLICATION supabase_realtime ADD TABLE public.swap_sessions;
ALTER TABLE public.swap_sessions REPLICA IDENTITY FULL;

-- 5. User ratings
CREATE TABLE public.user_ratings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trade_id    UUID NOT NULL REFERENCES public.trade_proposals(id) ON DELETE CASCADE,
  rater_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rated_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score       INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  on_time     BOOLEAN NOT NULL DEFAULT TRUE,
  had_stickers BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (trade_id, rater_id)
);
ALTER TABLE public.user_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users insert own ratings" ON public.user_ratings FOR INSERT TO authenticated WITH CHECK (auth.uid()=rater_id);
CREATE POLICY "ratings readable by authenticated" ON public.user_ratings FOR SELECT TO authenticated USING (true);

-- 6. Karma on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS karma INTEGER NOT NULL DEFAULT 0;

-- Trigger: add karma on 5-star rating
CREATE OR REPLACE FUNCTION public.handle_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.score = 5 THEN
    UPDATE public.profiles SET karma = karma + 1 WHERE id = NEW.rated_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_rating_insert
  AFTER INSERT ON public.user_ratings
  FOR EACH ROW EXECUTE FUNCTION public.handle_rating();

-- RPC: complete swap — verify PIN, swap inventory, create session record
CREATE OR REPLACE FUNCTION public.complete_swap(_trade_id UUID, _pin TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _me UUID := auth.uid();
  _session public.swap_sessions;
  _proposal public.trade_proposals;
  _match public.matches;
  _other UUID;
BEGIN
  -- Validate PIN
  SELECT * INTO _session FROM public.swap_sessions WHERE trade_id=_trade_id AND pin=_pin;
  IF NOT FOUND THEN RETURN jsonb_build_object('error','Invalid PIN'); END IF;
  IF _session.completed THEN RETURN jsonb_build_object('error','Already completed'); END IF;

  SELECT * INTO _proposal FROM public.trade_proposals WHERE id=_trade_id;
  SELECT * INTO _match FROM public.matches WHERE id=_proposal.match_id;

  _other := CASE WHEN _match.user_a = _me THEN _match.user_b ELSE _match.user_a END;

  -- Swap inventory:
  -- proposer gives give_ids → remove duplicate status for proposer, add as owned for other
  -- receiver gives receive_ids → remove duplicate status for other, add as owned for proposer

  -- proposer's give_ids: mark as owned for _other, remove from proposer's dupes
  UPDATE public.user_inventory SET status='owned' WHERE user_id=_other AND sticker_id=ANY(_proposal.give_ids);
  -- insert any that _other doesn't have yet
  INSERT INTO public.user_inventory (user_id, sticker_id, status)
  SELECT _other, unnest(_proposal.give_ids), 'owned'
  ON CONFLICT (user_id, sticker_id) DO UPDATE SET status='owned';

  UPDATE public.user_inventory SET status='owned' WHERE user_id=_proposal.proposer_id AND sticker_id=ANY(_proposal.give_ids);

  -- receiver's give_ids (receive_ids from proposer's perspective):
  INSERT INTO public.user_inventory (user_id, sticker_id, status)
  SELECT _proposal.proposer_id, unnest(_proposal.receive_ids), 'owned'
  ON CONFLICT (user_id, sticker_id) DO UPDATE SET status='owned';

  UPDATE public.user_inventory SET status='owned' WHERE user_id=_other AND sticker_id=ANY(_proposal.receive_ids);

  -- Mark complete
  UPDATE public.swap_sessions SET completed=TRUE WHERE id=_session.id;
  UPDATE public.trade_proposals SET status='locked' WHERE id=_trade_id;

  RETURN jsonb_build_object('ok', TRUE, 'give_count', array_length(_proposal.give_ids,1), 'receive_count', array_length(_proposal.receive_ids,1));
END;
$$;
