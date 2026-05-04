-- The original swap_sessions policies only allowed access via trade_id,
-- but the simplified flow creates sessions with match_id only.
-- Drop old policies and replace with match-aware ones.

DROP POLICY IF EXISTS "swap sessions readable by trade members"  ON public.swap_sessions;
DROP POLICY IF EXISTS "swap sessions updatable by trade members" ON public.swap_sessions;

CREATE POLICY "swap sessions readable by match members"
  ON public.swap_sessions FOR SELECT TO authenticated
  USING (
    (match_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
    ))
    OR
    (trade_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.trade_proposals tp
      JOIN public.matches m ON m.id = tp.match_id
      WHERE tp.id = trade_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
    ))
  );

CREATE POLICY "swap sessions insertable by match members"
  ON public.swap_sessions FOR INSERT TO authenticated
  WITH CHECK (
    match_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
    )
  );

CREATE POLICY "swap sessions updatable by match members"
  ON public.swap_sessions FOR UPDATE TO authenticated
  USING (
    (match_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
    ))
    OR
    (trade_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.trade_proposals tp
      JOIN public.matches m ON m.id = tp.match_id
      WHERE tp.id = trade_id AND (m.user_a = auth.uid() OR m.user_b = auth.uid())
    ))
  );
