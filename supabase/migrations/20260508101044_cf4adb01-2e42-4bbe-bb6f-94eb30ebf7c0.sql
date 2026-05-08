
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.place_bet(UUID, UUID, BIGINT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.resolve_match(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_bet(UUID, UUID, BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_match(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated;
