CREATE TABLE IF NOT EXISTS public.ios_waitlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ios_waitlist_email_unique UNIQUE (email)
);

ALTER TABLE public.ios_waitlist ENABLE ROW LEVEL SECURITY;

-- Anyone can join the waitlist (no auth required)
CREATE POLICY "public insert" ON public.ios_waitlist
  FOR INSERT WITH CHECK (true);
