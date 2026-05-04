-- Decouple meetup + swap from trade proposals so the flow works
-- without any structured negotiation.

-- meetup_slots: add match_id, make trade_id optional
ALTER TABLE public.meetup_slots ADD COLUMN IF NOT EXISTS match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE;
ALTER TABLE public.meetup_slots ALTER COLUMN trade_id DROP NOT NULL;

-- swap_sessions: add match_id, per-user completion flags, make trade_id optional
ALTER TABLE public.swap_sessions ADD COLUMN IF NOT EXISTS match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE;
ALTER TABLE public.swap_sessions ALTER COLUMN trade_id DROP NOT NULL;
ALTER TABLE public.swap_sessions ADD COLUMN IF NOT EXISTS complete_a BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.swap_sessions ADD COLUMN IF NOT EXISTS complete_b BOOLEAN NOT NULL DEFAULT FALSE;

-- Drop the old UNIQUE on trade_id so we can have sessions per match too
ALTER TABLE public.swap_sessions DROP CONSTRAINT IF EXISTS swap_sessions_trade_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS swap_sessions_match_id_key ON public.swap_sessions (match_id) WHERE match_id IS NOT NULL;

-- RPC: one user confirms swap complete; when both have, award +10 karma each
CREATE OR REPLACE FUNCTION public.confirm_swap(_match_id UUID, _is_user_a BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _session public.swap_sessions;
  _match   public.matches;
  _done    BOOLEAN := FALSE;
BEGIN
  -- upsert session so it's safe to call first
  INSERT INTO public.swap_sessions (match_id, pin, complete_a, complete_b)
  VALUES (_match_id, '', FALSE, FALSE)
  ON CONFLICT (match_id) DO NOTHING;

  UPDATE public.swap_sessions
  SET complete_a = CASE WHEN _is_user_a     THEN TRUE ELSE complete_a END,
      complete_b = CASE WHEN NOT _is_user_a THEN TRUE ELSE complete_b END
  WHERE match_id = _match_id
  RETURNING * INTO _session;

  IF _session.complete_a AND _session.complete_b AND NOT _session.completed THEN
    UPDATE public.swap_sessions SET completed = TRUE WHERE match_id = _match_id;
    SELECT * INTO _match FROM public.matches WHERE id = _match_id;
    UPDATE public.profiles SET karma = karma + 10 WHERE id IN (_match.user_a, _match.user_b);
    _done := TRUE;
  END IF;

  RETURN jsonb_build_object('completed', _done, 'complete_a', _session.complete_a, 'complete_b', _session.complete_b);
END;
$$;

-- RPC: get swap compatibility for a match (give/receive counts)
CREATE OR REPLACE FUNCTION public.get_match_compatibility(_match_id UUID)
RETURNS TABLE(give_count BIGINT, receive_count BIGINT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  other AS (
    SELECT CASE WHEN m.user_a = (SELECT uid FROM me) THEN m.user_b ELSE m.user_a END AS uid
    FROM public.matches m WHERE m.id = _match_id
  ),
  my_dupes    AS (SELECT sticker_id FROM public.user_inventory WHERE user_id=(SELECT uid FROM me)    AND status='duplicate'),
  other_dupes AS (SELECT sticker_id FROM public.user_inventory WHERE user_id=(SELECT uid FROM other) AND status='duplicate'),
  my_owned    AS (SELECT sticker_id FROM public.user_inventory WHERE user_id=(SELECT uid FROM me)),
  other_owned AS (SELECT sticker_id FROM public.user_inventory WHERE user_id=(SELECT uid FROM other))
  SELECT
    (SELECT COUNT(*) FROM my_dupes    d WHERE d.sticker_id NOT IN (SELECT sticker_id FROM other_owned)) AS give_count,
    (SELECT COUNT(*) FROM other_dupes d WHERE d.sticker_id NOT IN (SELECT sticker_id FROM my_owned))    AS receive_count;
$$;
