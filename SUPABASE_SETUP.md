# Supabase Setup Guide for NUJ

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign in or create an account
3. Click "New Project"
4. Enter project details (name, password, region)
5. Wait for project to initialize (~2-3 minutes)

## 2. Get Your API Credentials

1. In your Supabase project, go to **Settings** → **API**
2. Copy:
   - **Project URL** → Set as `VITE_SUPABASE_URL`
   - **Anon (public)** → Set as `VITE_SUPABASE_ANON_KEY`

## 3. Create Database Tables with RLS

Go to **SQL Editor** → **New Query** and run this:

```sql
-- Create profiles table (stores user info)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create check_ins table
CREATE TABLE check_ins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create mates table
CREATE TABLE mates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mate_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create meet_ups table
CREATE TABLE meet_ups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create nujs table
CREATE TABLE nujs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_ins ENABLE ROW LEVEL SECURITY;
ALTER TABLE mates ENABLE ROW LEVEL SECURITY;
ALTER TABLE meet_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE nujs ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can only SELECT/UPDATE their own
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Check-ins: Users can only see/insert/update their own
CREATE POLICY "Users can view their own check-ins"
  ON check_ins FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own check-ins"
  ON check_ins FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own check-ins"
  ON check_ins FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Mates: Users can see connections where they're involved
CREATE POLICY "Users can view mate connections they're part of"
  ON mates FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = mate_user_id);

CREATE POLICY "Users can insert mate connections for themselves"
  ON mates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update mate connections they're part of"
  ON mates FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() = mate_user_id)
  WITH CHECK (auth.uid() = user_id);

-- Meet-ups: Users can only see/insert/update their own
CREATE POLICY "Users can view their own meet-ups"
  ON meet_ups FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own meet-ups"
  ON meet_ups FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own meet-ups"
  ON meet_ups FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- NUJs: Users can only see/insert/update their own
CREATE POLICY "Users can view their own NUJs"
  ON nujs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own NUJs"
  ON nujs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own NUJs"
  ON nujs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

## 4. Update Your App

### Install Supabase Client

```bash
npm install @supabase/supabase-js
```

### Set Environment Variables

Create `.env.local` in your project root:

```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_public_key
```

### Test Your Setup

1. Run your app: `npm run dev`
2. Try to register a new account
3. Check Supabase Dashboard → **SQL Editor** → Run:
   ```sql
   SELECT * FROM profiles;
   ```
4. You should see your new user profile

## 5. Test RLS Policies

### Verify SELECT Policy (Users can see their own data)

```sql
-- Get a user ID from your profiles table
SELECT id, email FROM profiles LIMIT 1;

-- Run this in SQL Editor (it will use the first authenticated user)
SET JWT TO 'YOUR_JWT_TOKEN';
SELECT * FROM check_ins;
-- Should return only that user's check-ins
```

### Verify INSERT Policy (Users can only insert for themselves)

```sql
-- This should work (inserting for current user)
INSERT INTO check_ins (user_id) VALUES (auth.uid());

-- This should fail (trying to insert for another user)
INSERT INTO check_ins (user_id) VALUES ('other-user-id');
```

## 6. Deploy to Vercel

### Add Environment Variables to Vercel

1. Go to your Vercel project settings
2. **Settings** → **Environment Variables**
3. Add:
   - `VITE_SUPABASE_URL` = Your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = Your Supabase Anon Key
4. Redeploy your project

## Troubleshooting

### "Missing Supabase credentials" Error
- Check `.env.local` exists and has correct values
- Verify environment variables are set in Vercel
- Restart dev server: `npm run dev`

### "Invalid credentials" on Login
- Check user exists in Supabase Auth (Settings → Authentication → Users)
- Verify password is correct
- Check email is spelled correctly

### RLS Policy Violations
- Ensure you're authenticated (JWT token in Authorization header)
- Check policy: `SELECT * FROM check_ins WHERE user_id = auth.uid();`
- Verify user_id matches current user's UUID

### Profile Not Creating on Register
- Check Supabase Auth user was created (Dashboard → Authentication)
- Verify profile INSERT policy allows new users
- Check database logs for errors
