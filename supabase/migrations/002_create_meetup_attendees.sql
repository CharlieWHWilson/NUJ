-- Meetup attendance table
CREATE TABLE IF NOT EXISTS public.meetup_attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meetup_id TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(meetup_id, user_id)
);

ALTER TABLE public.meetup_attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their meetup attendance" ON public.meetup_attendees
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can join a meetup" ON public.meetup_attendees
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave a meetup" ON public.meetup_attendees
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_meetup_attendees_user_id ON public.meetup_attendees(user_id);
CREATE INDEX IF NOT EXISTS idx_meetup_attendees_meetup_id ON public.meetup_attendees(meetup_id);
