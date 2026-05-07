-- Give a specific user 371 randomly owned stickers for Final 10 testing.
-- Replace the email below with the test account email.
DO $$
DECLARE
  _user_id uuid;
BEGIN
  SELECT au.id INTO _user_id
  FROM auth.users au
  WHERE au.email = 'martijeffre@gmail.com'
  LIMIT 1;

  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Clear existing inventory for clean test
  DELETE FROM public.user_inventory WHERE user_id = _user_id;

  -- Insert 371 random stickers as owned
  INSERT INTO public.user_inventory (user_id, sticker_id, status)
  SELECT
    _user_id,
    id,
    'owned'
  FROM public.stickers
  ORDER BY random()
  LIMIT 371
  ON CONFLICT (user_id, sticker_id) DO NOTHING;

  RAISE NOTICE 'Inserted 371 stickers for user %', _user_id;
END $$;
