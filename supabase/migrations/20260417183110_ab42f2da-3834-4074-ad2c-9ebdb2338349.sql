-- Allow active staff (admins, finance managers, super admins, church admins) to delete payments
CREATE POLICY "Active staff can delete payments"
ON public.payments
FOR DELETE
TO authenticated
USING (public.is_active_staff(auth.uid()));