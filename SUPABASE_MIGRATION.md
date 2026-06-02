# Supabase Migration Guide - Mates, Groups, and NUJs

This guide explains how to migrate from localStorage to Supabase for mates, groups, and NUJ data.

## Step 1: Run the SQL Migration

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Create a new query and paste the contents of `supabase/migrations/001_create_mates_and_groups.sql`
4. Run the migration

This will create the following tables with proper RLS policies:
- `mates` - User's mates with presence status
- `groups` - User's groups/categories
- `group_mates` - Junction table linking groups to mates
- `nujs_received` - Incoming NUJs from mates
- `nujs_sent` - Outgoing NUJs to mates

## Step 2: Environment Variables

Your `.env.local` should already have:
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Step 3: Update Pages to Use Supabase Hooks

The following new hooks have been created:
- `useMatesSupabase()` - Load/manage mates from Supabase
- `useGroupsSupabase()` - Load/manage groups from Supabase  
- `useNujsSupabase()` - Load/manage NUJs from Supabase

### Example usage in a page:

```tsx
import { useMatesSupabase } from "@/hooks/useMatesSupabase";

export const MyPage = () => {
  const { mates, loading, error, addMate, removeMate } = useMatesSupabase();

  if (loading) return <div>Loading mates...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {mates.map(mate => (
        <div key={mate.id}>{mate.name}</div>
      ))}
    </div>
  );
};
```

## Step 4: Backwards Compatibility

For now, pages can continue to use localStorage (`mockData`). To transition:

1. Update one page at a time to use the Supabase hooks
2. Clear browser localStorage when ready to switch
3. Use the "Reset app data" button on Profile page if needed

## Step 5: Migration from localStorage to Supabase (Manual)

If users have existing data in localStorage, it needs to be manually uploaded:

```tsx
// One-time migration script (run in browser console)
import { supabase } from "@/lib/supabase";

const migrateLocalStorageToSupabase = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Get localStorage mates
  const localMates = JSON.parse(localStorage.getItem("nuj.mates.v1") || "[]");
  
  // Insert into Supabase
  for (const mate of localMates) {
    await supabase.from("mates").insert({
      user_id: user.id,
      name: mate.name,
      initials: mate.initials,
      last_checkin: mate.lastCheckin,
      days_since_checkin: mate.daysSinceCheckin,
    });
  }

  console.log(`Migrated ${localMates.length} mates to Supabase`);
};
```

## Testing

1. Log in with a test account
2. Add some mates using the UI
3. Verify they appear in Supabase dashboard → Tables → mates
4. Verify they persist when you refresh the page
5. Log out and log in with a different account to verify data isolation

## Deployment

Once all pages have been migrated to use Supabase hooks:

1. Build: `npm run build`
2. Deploy to Vercel: Follow normal deployment process
3. The app will be fully live with Supabase backend

## Notes

- All data is user-scoped via `auth.uid()` RLS policies
- Deleting your account will cascade-delete all your mates, groups, and NUJs
- Data is automatically backed up by Supabase
