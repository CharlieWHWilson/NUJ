ALTER TABLE public.mates
  ADD COLUMN IF NOT EXISTS mate_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS public.checkins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ NOT NULL,
  checked_in_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view their own check-ins" ON public.checkins
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can create their own check-ins" ON public.checkins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update their own check-ins" ON public.checkins
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can delete their own check-ins" ON public.checkins
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_mates_mate_user_id ON public.mates(mate_user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_checked_in_date ON public.checkins(checked_in_date);
