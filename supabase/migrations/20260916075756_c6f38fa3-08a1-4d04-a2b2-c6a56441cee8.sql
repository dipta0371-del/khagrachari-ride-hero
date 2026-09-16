REVOKE EXECUTE ON FUNCTION public.user_rating(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_rating(uuid) TO authenticated;