CREATE OR REPLACE FUNCTION public.record_swipe(_receiver uuid, _direction swipe_dir)
RETURNS TABLE(matched boolean, match_id uuid, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _me UUID := auth.uid();
  _tier TEXT;
  _is_pro BOOLEAN;
  _unlimited BOOLEAN;
  _today_count INT;
  _max INT := 20;
  _new_match_id UUID;
  _is_match BOOLEAN := FALSE;
  _a UUID; _b UUID;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'unauth'; END IF;
  SELECT tier, is_pro INTO _tier, _is_pro FROM public.profiles WHERE id=_me;
  _unlimited := COALESCE(_tier = 'premium', false) OR COALESCE(_is_pro, false);

  INSERT INTO public.daily_swipes(user_id, day, count)
    VALUES (_me, CURRENT_DATE, 0)
    ON CONFLICT (user_id, day) DO NOTHING;
  SELECT count INTO _today_count FROM public.daily_swipes WHERE user_id=_me AND day=CURRENT_DATE;

  IF NOT _unlimited AND _today_count >= _max THEN
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

  RETURN QUERY SELECT _is_match, _new_match_id,
    CASE WHEN _unlimited THEN 9999 ELSE GREATEST(0, _max - (_today_count+1)) END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_swipes_remaining()
RETURNS TABLE(remaining integer, unlimited boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _me UUID := auth.uid();
  _tier TEXT;
  _is_pro BOOLEAN;
  _unlimited BOOLEAN;
  _today_count INT := 0;
  _max INT := 20;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'unauth'; END IF;
  SELECT tier, is_pro INTO _tier, _is_pro FROM public.profiles WHERE id=_me;
  _unlimited := COALESCE(_tier = 'premium', false) OR COALESCE(_is_pro, false);
  SELECT count INTO _today_count FROM public.daily_swipes WHERE user_id=_me AND day=CURRENT_DATE;
  RETURN QUERY SELECT
    CASE WHEN _unlimited THEN 9999 ELSE GREATEST(0, _max - COALESCE(_today_count,0)) END,
    _unlimited;
END;
$function$;