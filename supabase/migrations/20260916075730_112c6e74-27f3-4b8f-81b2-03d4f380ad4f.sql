-- rides: bargaining, pickup code, sharing, timing
ALTER TABLE public.rides
  ADD COLUMN IF NOT EXISTS pricing_mode text NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS offered_fare integer,
  ADD COLUMN IF NOT EXISTS pickup_code text NOT NULL DEFAULT lpad((floor(random()*10000))::int::text, 4, '0'),
  ADD COLUMN IF NOT EXISTS share_token text NOT NULL DEFAULT encode(gen_random_bytes(12), 'hex'),
  ADD COLUMN IF NOT EXISTS cancelled_by uuid,
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS rides_share_token_key ON public.rides (share_token);

-- ride offers (inDriver style bargaining)
CREATE TABLE IF NOT EXISTS public.ride_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL CHECK (amount > 0 AND amount <= 10000),
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ride_id, driver_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ride_offers TO authenticated;
GRANT ALL ON public.ride_offers TO service_role;
ALTER TABLE public.ride_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drivers create own offers" ON public.ride_offers
  FOR INSERT TO authenticated
  WITH CHECK (
    driver_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.drivers d
      JOIN public.rides r ON r.id = ride_offers.ride_id
      WHERE d.user_id = auth.uid() AND d.approved AND d.vehicle = r.vehicle
        AND r.status = 'requested'
    )
  );

CREATE POLICY "read own or my ride offers" ON public.ride_offers
  FOR SELECT TO authenticated
  USING (
    driver_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_offers.ride_id AND r.rider_id = auth.uid())
    OR app_private.has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "drivers update own offers" ON public.ride_offers
  FOR UPDATE TO authenticated
  USING (driver_id = auth.uid()) WITH CHECK (driver_id = auth.uid());

CREATE POLICY "drivers delete own offers" ON public.ride_offers
  FOR DELETE TO authenticated
  USING (driver_id = auth.uid());

CREATE TRIGGER ride_offers_updated_at BEFORE UPDATE ON public.ride_offers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- saved places
CREATE TABLE IF NOT EXISTS public.saved_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  name text NOT NULL,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, label)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_places TO authenticated;
GRANT ALL ON public.saved_places TO service_role;
ALTER TABLE public.saved_places ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manage own saved places" ON public.saved_places
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TRIGGER saved_places_updated_at BEFORE UPDATE ON public.saved_places
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ride reports
CREATE TABLE IF NOT EXISTS public.ride_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  details text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.ride_reports TO authenticated;
GRANT ALL ON public.ride_reports TO service_role;
ALTER TABLE public.ride_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report rides i joined" ON public.ride_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid() AND app_private.is_ride_participant(ride_id, auth.uid()));

CREATE POLICY "read own reports or admin" ON public.ride_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR app_private.has_role(auth.uid(), 'admin'::app_role));

-- average rating helper
CREATE OR REPLACE FUNCTION public.user_rating(_user_id uuid)
RETURNS TABLE (average numeric, total bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT round(avg(score)::numeric, 1), count(*)
  FROM public.ride_ratings
  WHERE ratee_id = _user_id;
$$;

GRANT EXECUTE ON FUNCTION public.user_rating(uuid) TO authenticated;