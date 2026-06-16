GRANT EXECUTE ON FUNCTION public.is_active_staff(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid)             TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_non_super_staff(uuid)         TO authenticated;