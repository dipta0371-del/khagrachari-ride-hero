CREATE SCHEMA IF NOT EXISTS app_private;
GRANT USAGE ON SCHEMA app_private TO authenticated;

CREATE OR REPLACE FUNCTION app_private.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION app_private.is_ride_participant(_ride_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.rides r
                 WHERE r.id = _ride_id AND (r.rider_id = _user_id OR r.driver_id = _user_id));
$$;

CREATE OR REPLACE FUNCTION app_private.shares_active_ride(_a UUID, _b UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.rides r
    WHERE r.status IN ('accepted','arrived','in_progress')
      AND ((r.rider_id = _a AND r.driver_id = _b) OR (r.rider_id = _b AND r.driver_id = _a))
  );
$$;

REVOKE ALL ON FUNCTION app_private.has_role(UUID, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.is_ride_participant(UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION app_private.shares_active_ride(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION app_private.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.is_ride_participant(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION app_private.shares_active_ride(UUID, UUID) TO authenticated;

-- rebuild policies against the private helpers
DROP POLICY "read own roles" ON public.user_roles;
CREATE POLICY "read own roles" ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR app_private.has_role(auth.uid(),'admin'));

DROP POLICY "read own or ride-partner profile" ON public.profiles;
CREATE POLICY "read own or ride-partner profile" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR app_private.has_role(auth.uid(),'admin') OR app_private.shares_active_ride(auth.uid(), id));

DROP POLICY "read own driver row" ON public.drivers;
CREATE POLICY "read own driver row" ON public.drivers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR app_private.has_role(auth.uid(),'admin') OR app_private.shares_active_ride(auth.uid(), user_id));
DROP POLICY "admins manage drivers" ON public.drivers;
CREATE POLICY "admins manage drivers" ON public.drivers FOR UPDATE TO authenticated
  USING (app_private.has_role(auth.uid(),'admin')) WITH CHECK (app_private.has_role(auth.uid(),'admin'));

DROP POLICY "admins read all rides" ON public.rides;
CREATE POLICY "admins read all rides" ON public.rides FOR SELECT TO authenticated
  USING (app_private.has_role(auth.uid(),'admin'));
DROP POLICY "admins update rides" ON public.rides;
CREATE POLICY "admins update rides" ON public.rides FOR UPDATE TO authenticated
  USING (app_private.has_role(auth.uid(),'admin')) WITH CHECK (app_private.has_role(auth.uid(),'admin'));

DROP POLICY "participants read locations" ON public.ride_locations;
CREATE POLICY "participants read locations" ON public.ride_locations FOR SELECT TO authenticated
  USING (app_private.is_ride_participant(ride_id, auth.uid()));
DROP POLICY "share own location" ON public.ride_locations;
CREATE POLICY "share own location" ON public.ride_locations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND app_private.is_ride_participant(ride_id, auth.uid()));

DROP POLICY "read ratings about me or by me" ON public.ride_ratings;
CREATE POLICY "read ratings about me or by me" ON public.ride_ratings FOR SELECT TO authenticated
  USING (rater_id = auth.uid() OR ratee_id = auth.uid() OR app_private.has_role(auth.uid(),'admin'));
DROP POLICY "rate rides i took part in" ON public.ride_ratings;
CREATE POLICY "rate rides i took part in" ON public.ride_ratings FOR INSERT TO authenticated
  WITH CHECK (rater_id = auth.uid() AND app_private.is_ride_participant(ride_id, auth.uid()));

DROP POLICY "admins write settings" ON public.app_settings;
CREATE POLICY "admins write settings" ON public.app_settings FOR ALL TO authenticated
  USING (app_private.has_role(auth.uid(),'admin')) WITH CHECK (app_private.has_role(auth.uid(),'admin'));

DROP FUNCTION public.has_role(UUID, public.app_role);
DROP FUNCTION public.is_ride_participant(UUID, UUID);
DROP FUNCTION public.shares_active_ride(UUID, UUID);