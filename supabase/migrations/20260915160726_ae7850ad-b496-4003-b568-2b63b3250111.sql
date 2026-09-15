-- ===== enums =====
CREATE TYPE public.app_role AS ENUM ('rider','driver','admin');
CREATE TYPE public.vehicle_type AS ENUM ('bike','tomtom');
CREATE TYPE public.ride_status AS ENUM ('requested','accepted','arrived','in_progress','completed','cancelled');

-- ===== shared trigger fn =====
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ===== profiles =====
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== roles =====
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- ===== drivers =====
CREATE TABLE public.drivers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  vehicle public.vehicle_type NOT NULL,
  plate TEXT NOT NULL DEFAULT '',
  approved BOOLEAN NOT NULL DEFAULT false,
  online BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.drivers TO authenticated;
GRANT ALL ON public.drivers TO service_role;
ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER drivers_updated_at BEFORE UPDATE ON public.drivers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ===== rides =====
CREATE TABLE public.rides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rider_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.ride_status NOT NULL DEFAULT 'requested',
  vehicle public.vehicle_type NOT NULL,
  passengers INT NOT NULL DEFAULT 1,
  note TEXT NOT NULL DEFAULT '',
  pickup_name TEXT NOT NULL,
  pickup_lat DOUBLE PRECISION NOT NULL,
  pickup_lng DOUBLE PRECISION NOT NULL,
  dropoff_name TEXT NOT NULL,
  dropoff_lat DOUBLE PRECISION NOT NULL,
  dropoff_lng DOUBLE PRECISION NOT NULL,
  distance_km NUMERIC(6,1) NOT NULL,
  fare INT NOT NULL,
  cancel_reason TEXT,
  idempotency_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rider_id, idempotency_key)
);
CREATE UNIQUE INDEX rides_one_active_rider ON public.rides (rider_id)
  WHERE status IN ('requested','accepted','arrived','in_progress');
CREATE UNIQUE INDEX rides_one_active_driver ON public.rides (driver_id)
  WHERE driver_id IS NOT NULL AND status IN ('accepted','arrived','in_progress');
CREATE INDEX rides_status_idx ON public.rides (status, vehicle);
GRANT SELECT, INSERT, UPDATE ON public.rides TO authenticated;
GRANT ALL ON public.rides TO service_role;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER rides_updated_at BEFORE UPDATE ON public.rides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.is_ride_participant(_ride_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.rides r
                 WHERE r.id = _ride_id AND (r.rider_id = _user_id OR r.driver_id = _user_id));
$$;

CREATE OR REPLACE FUNCTION public.shares_active_ride(_a UUID, _b UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.status IN ('accepted','arrived','in_progress')
      AND ((r.rider_id = _a AND r.driver_id = _b) OR (r.rider_id = _b AND r.driver_id = _a))
  );
$$;

-- profile policies (need shares_active_ride)
CREATE POLICY "read own or ride-partner profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.shares_active_ride(auth.uid(), id));
CREATE POLICY "insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());
CREATE POLICY "update own profile" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- driver policies
CREATE POLICY "read own driver row" ON public.drivers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.shares_active_ride(auth.uid(), user_id));
CREATE POLICY "create own driver row" ON public.drivers FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "update own driver row" ON public.drivers FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "admins manage drivers" ON public.drivers FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ride policies
CREATE POLICY "riders read own rides" ON public.rides FOR SELECT TO authenticated
  USING (rider_id = auth.uid());
CREATE POLICY "drivers read assigned rides" ON public.rides FOR SELECT TO authenticated
  USING (driver_id = auth.uid());
CREATE POLICY "approved drivers read open requests" ON public.rides FOR SELECT TO authenticated
  USING (status = 'requested' AND EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.user_id = auth.uid() AND d.approved AND d.vehicle = rides.vehicle));
CREATE POLICY "admins read all rides" ON public.rides FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "riders create own rides" ON public.rides FOR INSERT TO authenticated
  WITH CHECK (rider_id = auth.uid() AND driver_id IS NULL AND status = 'requested');
CREATE POLICY "riders update own rides" ON public.rides FOR UPDATE TO authenticated
  USING (rider_id = auth.uid()) WITH CHECK (rider_id = auth.uid());
CREATE POLICY "drivers update their rides" ON public.rides FOR UPDATE TO authenticated
  USING (driver_id = auth.uid() OR (status = 'requested' AND EXISTS (
    SELECT 1 FROM public.drivers d
    WHERE d.user_id = auth.uid() AND d.approved AND d.online AND d.vehicle = rides.vehicle)))
  WITH CHECK (driver_id = auth.uid());
CREATE POLICY "admins update rides" ON public.rides FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ===== live locations =====
CREATE TABLE public.ride_locations (
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  accuracy DOUBLE PRECISION NOT NULL,
  captured_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (ride_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ride_locations TO authenticated;
GRANT ALL ON public.ride_locations TO service_role;
ALTER TABLE public.ride_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read locations" ON public.ride_locations FOR SELECT TO authenticated
  USING (public.is_ride_participant(ride_id, auth.uid()));
CREATE POLICY "share own location" ON public.ride_locations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_ride_participant(ride_id, auth.uid()));
CREATE POLICY "update own location" ON public.ride_locations FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "delete own location" ON public.ride_locations FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ===== ratings =====
CREATE TABLE public.ride_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id UUID NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  rater_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ratee_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INT NOT NULL CHECK (score BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ride_id, rater_id)
);
GRANT SELECT, INSERT ON public.ride_ratings TO authenticated;
GRANT ALL ON public.ride_ratings TO service_role;
ALTER TABLE public.ride_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read ratings about me or by me" ON public.ride_ratings FOR SELECT TO authenticated
  USING (rater_id = auth.uid() OR ratee_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "rate rides i took part in" ON public.ride_ratings FOR INSERT TO authenticated
  WITH CHECK (rater_id = auth.uid() AND public.is_ride_participant(ride_id, auth.uid()));

-- ===== settings =====
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT INSERT, UPDATE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone reads settings" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "admins write settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER app_settings_updated_at BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.app_settings (key, value) VALUES
  ('rates', '{"bike":{"base":30,"perKm":15,"minimum":45},"tomtom":{"base":40,"perKm":20,"minimum":60}}'::jsonb),
  ('zone',  '{"lat":23.1193,"lng":91.9847,"radiusKm":10}'::jsonb);

-- ===== signup trigger =====
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id,
          COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
          NULLIF(NEW.raw_user_meta_data->>'phone', ''))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'rider')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();