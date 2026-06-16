DROP POLICY IF EXISTS "Authenticated users can insert their own logs" ON public.activity_logs;
CREATE POLICY "Users can insert their own logs"
ON public.activity_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);