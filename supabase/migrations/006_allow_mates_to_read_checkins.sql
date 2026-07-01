-- Allow users to read check-ins for users they have added as mates.
-- This keeps own check-ins readable and powers mate presence visibility.

DROP POLICY IF EXISTS "Users can view their own check-ins" ON public.checkins;

CREATE POLICY IF NOT EXISTS "Users can view relevant check-ins" ON public.checkins
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1
      FROM public.mates m
      WHERE m.user_id = auth.uid()
        AND m.mate_user_id = checkins.user_id
    )
  );
