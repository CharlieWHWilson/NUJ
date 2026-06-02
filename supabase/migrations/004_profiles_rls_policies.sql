-- Ensure profiles are queryable by ID and users can insert/update/delete only their own profile.
-- Run this in Supabase SQL editor if the profiles table already exists.

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Public profile lookup" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can delete their own profile" ON public.profiles
  FOR DELETE USING (auth.uid() = id);

CREATE INDEX IF NOT EXISTS idx_profiles_id ON public.profiles(id);
