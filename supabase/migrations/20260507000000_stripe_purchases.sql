-- Track Stripe purchases
CREATE TABLE IF NOT EXISTS public.stripe_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  stripe_session_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.stripe_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own purchases" ON public.stripe_purchases FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Service role can insert (webhook)
CREATE POLICY "service insert purchases" ON public.stripe_purchases FOR INSERT TO service_role WITH CHECK (true);
