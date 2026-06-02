# Running the Supabase Migration

This guide shows how to set up your Supabase database for the NUJ app.

## Step 1: Access Your Supabase Dashboard

1. Go to https://supabase.com
2. Sign in with your account
3. Navigate to your project: **fopxcfdghqyuannpkvwj**
4. Go to **SQL Editor** in the left sidebar

## Step 2: Create a New SQL Query

1. Click **New Query**
2. Give it a name: `Create NUJ Tables`
3. Copy the entire contents of `supabase/migrations/001_create_mates_and_groups.sql`
4. Paste it into the SQL editor
5. Click **Run**

You should see "Success" in the output. If you get an error, check:
- Are you authenticated to Supabase?
- Did you paste the entire migration file?

## Step 3: Verify Tables Were Created

1. Go to **Table Editor** in the left sidebar
2. You should see these new tables:
   - `mates`
   - `groups`
   - `group_mates`
   - `nujs_received`
   - `nujs_sent`
3. Click on each table to verify the columns match the schema

## Step 4: Test RLS Policies

1. Go to **Authentication** → **Policies**
2. You should see policies for each table:
   - Mates: 4 policies (select, insert, update, delete)
   - Groups: 4 policies
   - group_mates: 3 policies (select, insert, delete)
   - nujs_received: 3 policies
   - nujs_sent: 2 policies
3. Policies should reference `auth.uid() = user_id`

## Step 5: Start Using Supabase Hooks in Your App

The app already has Supabase auth working. Now you can use the new hooks:

```tsx
// In a React component
import { useMatesSupabase } from "@/hooks/useMatesSupabase";

export const MyPage = () => {
  const { mates, loading, error, addMate, removeMate } = useMatesSupabase();

  if (loading) return <p>Loading mates...</p>;
  if (error) return <p>Error: {error}</p>;

  return (
    <div>
      <ul>
        {mates.map(mate => (
          <li key={mate.id}>{mate.name}</li>
        ))}
      </ul>
    </div>
  );
};
```

## Troubleshooting

### "Row level security violation"
- Ensure you're authenticated to Supabase first
- Check that the user's ID matches the `user_id` in the table
- Verify the RLS policies were created correctly

### "Table does not exist"
- Run the migration again
- Make sure the migration ran without errors
- Refresh the Table Editor

### "Permission denied"
- Check that the RLS policies have the correct auth.uid() references
- Ensure your user is authenticated before inserting data

## Next Steps

1. **Update Dashboard.tsx** to use `useMatesSupabase` for loading mates
2. **Update AddMateSheet.tsx** to add mates to Supabase instead of localStorage
3. **Update MatesHub.tsx** to use Supabase mates
4. **Migrate existing localStorage data** (optional - see SUPABASE_MIGRATION.md)
5. **Deploy to Vercel** once all components are updated

## Manual Testing in Supabase

Want to test the database directly? You can insert test data in the Table Editor:

1. Go to **Table Editor** → **mates**
2. Click **Insert Row**
3. Fill in:
   - `user_id`: (Your user ID from Auth users table)
   - `name`: "Test Mate"
   - `initials`: "TM"
   - `last_checkin`: "today"
4. Click **Save**
5. The row should appear if your user_id is correct

If you get a "permission denied" error, check your RLS policies.
