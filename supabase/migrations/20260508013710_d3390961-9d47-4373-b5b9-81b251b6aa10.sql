
DROP POLICY IF EXISTS "check_ins readable by all authenticated" ON public.check_ins;
CREATE POLICY "users read own check_ins" ON public.check_ins
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "ratings readable by all authenticated" ON public.user_ratings;
CREATE POLICY "rater or rated read ratings" ON public.user_ratings
  FOR SELECT TO authenticated USING (auth.uid() = rater_id OR auth.uid() = rated_id);

DROP POLICY IF EXISTS "inventory readable by all authenticated" ON public.user_inventory;
CREATE POLICY "users read own inventory" ON public.user_inventory
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "authenticated can update venues" ON public.venues;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS emergency_contact;
