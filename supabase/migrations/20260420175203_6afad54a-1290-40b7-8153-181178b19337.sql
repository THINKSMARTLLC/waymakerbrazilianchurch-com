-- Add columns to user_profiles for first-login password change and audit
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_by UUID;

-- Helper: check if user is staff-level (admin/finance/church) but NOT super_admin
CREATE OR REPLACE FUNCTION public.is_non_super_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.user_profiles up ON up.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role IN ('admin', 'church_admin', 'finance_manager')
      AND up.status = 'active'
  ) AND NOT public.is_super_admin(_user_id);
$$;

-- Replace member DELETE policy: only super_admin can hard-delete
DROP POLICY IF EXISTS "Active staff can delete members" ON public.members;

CREATE POLICY "Super admin can delete members"
ON public.members
FOR DELETE
TO authenticated
USING (public.is_super_admin(auth.uid()));