-- Enable RLS
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;

-- Mates table
CREATE TABLE IF NOT EXISTS public.mates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  initials TEXT NOT NULL,
  last_checkin TEXT CHECK (last_checkin IN ('today', 'yesterday', 'few-days')) NOT NULL DEFAULT 'few-days',
  days_since_checkin INT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Groups table
CREATE TABLE IF NOT EXISTS public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Junction table: groups to mates
CREATE TABLE IF NOT EXISTS public.group_mates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  mate_id UUID NOT NULL REFERENCES public.mates(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, mate_id)
);

-- NUJs received
CREATE TABLE IF NOT EXISTS public.nujs_received (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_mate_id UUID NOT NULL REFERENCES public.mates(id) ON DELETE CASCADE,
  received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- NUJs sent
CREATE TABLE IF NOT EXISTS public.nujs_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  to_mate_id UUID NOT NULL REFERENCES public.mates(id) ON DELETE CASCADE,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.mates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_mates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nujs_received ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nujs_sent ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mates
CREATE POLICY "Users can view their own mates" ON public.mates
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create mates" ON public.mates
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own mates" ON public.mates
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own mates" ON public.mates
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for groups
CREATE POLICY "Users can view their own groups" ON public.groups
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create groups" ON public.groups
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own groups" ON public.groups
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own groups" ON public.groups
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for group_mates (check via group)
CREATE POLICY "Users can view group_mates for their groups" ON public.group_mates
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.groups WHERE id = group_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can add mates to their groups" ON public.group_mates
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.groups WHERE id = group_id AND user_id = auth.uid())
  );

CREATE POLICY "Users can remove mates from their groups" ON public.group_mates
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.groups WHERE id = group_id AND user_id = auth.uid())
  );

-- RLS Policies for nujs_received
CREATE POLICY "Users can view their received NUJs" ON public.nujs_received
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can receive NUJs" ON public.nujs_received
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their received NUJs" ON public.nujs_received
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for nujs_sent
CREATE POLICY "Users can view their sent NUJs" ON public.nujs_sent
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can send NUJs" ON public.nujs_sent
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create indexes for common queries
CREATE INDEX idx_mates_user_id ON public.mates(user_id);
CREATE INDEX idx_groups_user_id ON public.groups(user_id);
CREATE INDEX idx_group_mates_group_id ON public.group_mates(group_id);
CREATE INDEX idx_group_mates_mate_id ON public.group_mates(mate_id);
CREATE INDEX idx_nujs_received_user_id ON public.nujs_received(user_id);
CREATE INDEX idx_nujs_sent_user_id ON public.nujs_sent(user_id);
