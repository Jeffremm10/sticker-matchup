-- Meet & Swap venues system

CREATE TYPE public.venue_type AS ENUM ('coffee_shop','mall','transit_hub','kiosk');

CREATE TABLE public.venues (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        venue_type NOT NULL,
  lat         DOUBLE PRECISION NOT NULL,
  lng         DOUBLE PRECISION NOT NULL,
  address     TEXT,
  osm_id      TEXT,                        -- dedup key from Overpass
  nominations INTEGER NOT NULL DEFAULT 0,
  swap_count  INTEGER NOT NULL DEFAULT 0,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
CREATE UNIQUE INDEX venues_osm_id_key ON public.venues (osm_id) WHERE osm_id IS NOT NULL;
CREATE INDEX venues_location_idx ON public.venues USING GIST (
  ll_to_earth(lat, lng)
) WHERE pg_catalog.pg_extension_is_trusted('earthdistance') IS NOT NULL;

CREATE POLICY "venues readable by all authenticated" ON public.venues FOR SELECT TO authenticated USING (true);
CREATE POLICY "venues insertable by authenticated"  ON public.venues FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "venues updatable by authenticated"   ON public.venues FOR UPDATE TO authenticated USING (true);

-- Kiosk nominations (one per user per venue)
CREATE TABLE public.venue_nominations (
  user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, venue_id)
);
ALTER TABLE public.venue_nominations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "nominations readable by all authenticated" ON public.venue_nominations FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own nominations" ON public.venue_nominations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Check-ins
CREATE TYPE public.checkin_status AS ENUM ('active','completed','reported');

CREATE TABLE public.check_ins (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id         UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  status           checkin_status NOT NULL DEFAULT 'active',
  started_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at         TIMESTAMPTZ,
  emergency_contact TEXT
);
ALTER TABLE public.check_ins ENABLE ROW LEVEL SECURITY;
CREATE INDEX check_ins_venue_active_idx ON public.check_ins (venue_id, status) WHERE status = 'active';

CREATE POLICY "check_ins readable by authenticated"    ON public.check_ins FOR SELECT TO authenticated USING (true);
CREATE POLICY "users insert own check_ins"             ON public.check_ins FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own check_ins"             ON public.check_ins FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Venue reports
CREATE TABLE public.venue_reports (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  venue_id   UUID NOT NULL REFERENCES public.venues(id) ON DELETE CASCADE,
  reason     TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.venue_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users insert own reports" ON public.venue_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Emergency contact on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_contact TEXT;

-- Trigger: auto-verify kiosk at 5 nominations
CREATE OR REPLACE FUNCTION public.handle_nomination()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.venues
  SET nominations = nominations + 1,
      is_verified  = CASE WHEN nominations + 1 >= 5 THEN TRUE ELSE is_verified END
  WHERE id = NEW.venue_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_nomination_insert
  AFTER INSERT ON public.venue_nominations
  FOR EACH ROW EXECUTE FUNCTION public.handle_nomination();

-- Trigger: increment swap_count on completed check-in, auto-badge at 50
CREATE OR REPLACE FUNCTION public.handle_checkin_complete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status = 'active' THEN
    UPDATE public.venues
    SET swap_count  = swap_count + 1,
        is_verified = CASE WHEN swap_count + 1 >= 50 THEN TRUE ELSE is_verified END
    WHERE id = NEW.venue_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_checkin_complete
  AFTER UPDATE ON public.check_ins
  FOR EACH ROW EXECUTE FUNCTION public.handle_checkin_complete();

-- Realtime for co-location alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.check_ins;
ALTER TABLE public.check_ins REPLICA IDENTITY FULL;

-- RPC: upsert an OSM-sourced venue (idempotent by osm_id)
CREATE OR REPLACE FUNCTION public.upsert_osm_venue(
  _name TEXT, _type venue_type, _lat DOUBLE PRECISION, _lng DOUBLE PRECISION,
  _address TEXT, _osm_id TEXT
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id UUID;
BEGIN
  INSERT INTO public.venues (name, type, lat, lng, address, osm_id)
  VALUES (_name, _type, _lat, _lng, _address, _osm_id)
  ON CONFLICT (osm_id) DO UPDATE
    SET name = EXCLUDED.name, lat = EXCLUDED.lat, lng = EXCLUDED.lng, address = EXCLUDED.address
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;
