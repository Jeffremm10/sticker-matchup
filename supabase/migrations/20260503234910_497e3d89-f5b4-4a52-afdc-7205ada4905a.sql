
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.get_potential_matches(int) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.record_swipe(uuid, swipe_dir) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM anon, public, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_potential_matches(int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_swipe(uuid, swipe_dir) TO authenticated;
