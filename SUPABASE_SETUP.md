# Supabase Integration Setup

## 1. Create a Supabase Project
- Go to https://supabase.com and create a new project.
- Get your Project URL and anon public key from the Project Settings > API section.

## 2. Configure Environment Variables
- Copy `.env.example` to `.env.local` (or `.env` for local dev):
  ```sh
  cp .env.example .env.local
  ```
- Fill in your Supabase project URL and anon key in `.env.local`:
  ```env
  VITE_SUPABASE_URL=your-supabase-url
  VITE_SUPABASE_ANON_KEY=your-anon-key
  ```

## 3. Use the Supabase Client
- Import the client from `src/lib/supabaseClient.ts`:
  ```ts
  import { supabase } from "../lib/supabaseClient";
  // Example usage:
  // const { data, error } = await supabase.from('your_table').select('*');
  ```

## 4. Deploying
- Set the same environment variables in your hosting provider (Vercel, Netlify, etc.) dashboard.
- Build and deploy as usual.

## 5. Docs
- [Supabase Docs](https://supabase.com/docs)
