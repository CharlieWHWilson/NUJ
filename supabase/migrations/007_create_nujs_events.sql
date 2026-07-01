-- Unified NUJ event log for sender/recipient persistence across sessions.

CREATE TABLE IF NOT EXISTS public.nujs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  CONSTRAINT nujs_sender_not_recipient CHECK (sender_user_id <> recipient_user_id)
);

ALTER TABLE public.nujs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view own NUJs" ON public.nujs
  FOR SELECT USING (
    auth.uid() = sender_user_id
    OR auth.uid() = recipient_user_id
  );

CREATE POLICY IF NOT EXISTS "Users can send NUJs from self" ON public.nujs
  FOR INSERT WITH CHECK (auth.uid() = sender_user_id);

CREATE POLICY IF NOT EXISTS "Recipients can acknowledge NUJs" ON public.nujs
  FOR UPDATE USING (auth.uid() = recipient_user_id)
  WITH CHECK (auth.uid() = recipient_user_id);

CREATE POLICY IF NOT EXISTS "Recipients can delete received NUJs" ON public.nujs
  FOR DELETE USING (auth.uid() = recipient_user_id);

CREATE INDEX IF NOT EXISTS idx_nujs_sender_user_id ON public.nujs(sender_user_id);
CREATE INDEX IF NOT EXISTS idx_nujs_recipient_user_id ON public.nujs(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_nujs_created_at ON public.nujs(created_at DESC);