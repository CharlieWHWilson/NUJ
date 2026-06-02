-- Enable public lookup for profiles so users can find one another by ID.
-- This policy allows anyone to SELECT from profiles for lookup purposes,
-- but does not change insert/update/delete permissions.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Public profile lookup" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can delete their own profile" ON public.profiles
  FOR DELETE USING (auth.uid() = id);
