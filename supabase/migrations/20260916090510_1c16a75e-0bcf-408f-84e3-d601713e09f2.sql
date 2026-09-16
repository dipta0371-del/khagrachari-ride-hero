GRANT SELECT, INSERT, UPDATE, DELETE ON public.ride_offers TO authenticated;
GRANT ALL ON public.ride_offers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_places TO authenticated;
GRANT ALL ON public.saved_places TO service_role;
GRANT SELECT, INSERT ON public.ride_reports TO authenticated;
GRANT ALL ON public.ride_reports TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;
GRANT ALL ON public.device_tokens TO service_role;