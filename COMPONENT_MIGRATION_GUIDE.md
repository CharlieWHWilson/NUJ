# Component Migration Guide

This guide shows how to update key components to use Supabase hooks for mates and groups.

## AddMateSheet.tsx - Add Mates to Supabase

### Current Implementation (localStorage)
```tsx
const handleSearch = async (userId: string) => {
  // Find mate from Supabase profiles table
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (data) {
    // Add to localStorage
    const newMates = [...currentMates, {
      id: userId,
      name: data.username,
      initials: data.username.slice(0, 2).toUpperCase(),
      lastCheckin: "few-days",
    }];
    saveMatesToStorage(newMates);
  }
};
```

### Updated Implementation (Supabase)
```tsx
import { useMatesSupabase } from "@/hooks/useMatesSupabase";

export const AddMateSheet = ({ open, onOpenChange }: Props) => {
  const { addMate } = useMatesSupabase();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (userId: string) => {
    try {
      setLoading(true);
      
      // Find mate from Supabase profiles table
      const { data, error: fetchError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (fetchError) throw fetchError;
      if (!data) throw new Error("Mate not found");

      // Add to Supabase using the hook
      await addMate({
        name: data.username,
        initials: data.username.slice(0, 2).toUpperCase(),
        lastCheckin: "few-days",
      });

      // Close sheet and show success
      toast.success("Mate added!");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add mate");
    } finally {
      setLoading(false);
    }
  };

  // Rest of component stays the same
};
```

### Key Changes
1. Import `useMatesSupabase` hook
2. Call `addMate()` instead of `saveMatesToStorage()`
3. Handle `loading` and `error` states
4. Toast notification for success/failure
5. Sheet closes automatically after success

## Dashboard.tsx - Display Mates from Supabase

### Current Implementation
```tsx
import { mates, groups, nujsReceived } from "@/data/mockData";

const Dashboard = () => {
  const [mateList, setMateList] = useState(mates);
  // ... local state management for adding/removing
};
```

### Hybrid Approach (Recommended for gradual migration)

Update the Dashboard to use Supabase for mates while keeping localStorage for other data temporarily:

```tsx
import { useMatesSupabase } from "@/hooks/useMatesSupabase";
import { useGroupsSupabase } from "@/hooks/useGroupsSupabase";

const Dashboard = () => {
  // Get mates from Supabase
  const { mates, loading: matesLoading, error: matesError } = useMatesSupabase();
  // Get groups from Supabase
  const { groups, loading: groupsLoading, error: groupsError } = useGroupsSupabase();
  
  // Other state from mockData (temporary)
  const [nujCards, setNujCards] = useState(nujsReceived);
  const [nujSentCards, setNujSentCards] = useState(getNujsSent());

  if (matesLoading || groupsLoading) {
    return <LoadingSpinner />;
  }

  if (matesError || groupsError) {
    return <ErrorDisplay errors={{ matesError, groupsError }} />;
  }

  // Rest of component uses mates and groups from Supabase
  const sortedMates = [...mates].sort((a, b) => 
    getDaysSinceCheckin(a) - getDaysSinceCheckin(b)
  );

  return (
    <div>
      {/* All existing UI but using mates/groups from Supabase */}
    </div>
  );
};
```

## MatesHub.tsx - Update Mate List

### Updated Implementation
```tsx
import { useMatesSupabase } from "@/hooks/useMatesSupabase";

export const MatesHub = () => {
  const { mates, loading, error, removeMate, updateMate } = useMatesSupabase();
  const [addMateOpen, setAddMateOpen] = useState(false);

  const handleRemoveMate = async (mateId: string) => {
    try {
      await removeMate(mateId);
      toast.success("Mate removed");
    } catch (err) {
      toast.error("Failed to remove mate");
    }
  };

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      <TopNav onAddMate={() => setAddMateOpen(true)} />
      
      {loading && <p>Loading mates...</p>}
      {error && <p className="text-red-600">Error: {error}</p>}
      
      {!loading && !error && (
        <div className="px-5 py-4">
          {mates.length === 0 ? (
            <EmptyState onAddMate={() => setAddMateOpen(true)} />
          ) : (
            <div className="space-y-2">
              {mates.map(mate => (
                <MateRow
                  key={mate.id}
                  mate={mate}
                  onRemove={() => handleRemoveMate(mate.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <AddMateSheet open={addMateOpen} onOpenChange={setAddMateOpen} />
    </div>
  );
};
```

## Migration Strategy

### Phase 1: Set up (You are here)
✅ Create Supabase schema  
✅ Create React hooks  
⬜ Run SQL migration in Supabase  

### Phase 2: Add Mate Functionality
1. Update `AddMateSheet.tsx` to use `addMate()` from hook
2. Test: Add a mate via search, verify it appears in Supabase dashboard
3. Refresh page and verify mate still shows

### Phase 3: Display Mates
1. Update `MatesHub.tsx` to use `useMatesSupabase()`
2. Test: Can see mates from Supabase
3. Remove mate and verify it's deleted from Supabase

### Phase 4: Dashboard Integration
1. Update `Dashboard.tsx` to use Supabase hooks
2. Test: All mate operations work (view, add, remove)
3. Verify mates are sorted and filtered correctly

### Phase 5: Groups Migration
1. Update `GroupDetail.tsx` to use `useGroupsSupabase()`
2. Update group creation to save to Supabase
3. Update group member management

### Phase 6: NUJs Migration
1. Update `MatePage.tsx` to use `useNujsSupabase()` for sending
2. Update Dashboard to show NUJs from Supabase
3. Test send/receive NUJ flow

### Phase 7: Cleanup & Deploy
1. Remove localStorage code for mates/groups/NUJs
2. Keep localStorage only for local UI state (filters, preferences)
3. Run full end-to-end test
4. Deploy to Vercel

## Common Patterns

### Loading State
```tsx
const { mates, loading, error } = useMatesSupabase();

if (loading) return <LoadingSpinner />;
if (error) return <ErrorAlert message={error} />;
```

### Error Handling
```tsx
try {
  await addMate({ name, initials, lastCheckin });
  toast.success("Added!");
} catch (err) {
  toast.error(err instanceof Error ? err.message : "Failed");
}
```

### Automatic Updates
Once you use the Supabase hooks, operations automatically sync:
```tsx
// This automatically updates everywhere it's used
await removeMate(id);  // setMates state updates immediately
```

## Testing Checklist

Before moving to next phase:
- [ ] Mates load from Supabase
- [ ] Can add a new mate
- [ ] Mate appears in Supabase dashboard table
- [ ] New mate shows in UI after add
- [ ] Can remove a mate
- [ ] Removed mate is gone from Supabase
- [ ] Refresh page and mate state persists
- [ ] Errors display correctly to user
- [ ] Loading states show while fetching

## Troubleshooting

### "useXHook is not a function"
- Make sure you imported the hook: `import { useMatesSupabase } from "@/hooks/useMatesSupabase";`
- Check file path is correct

### Data doesn't appear after adding
- Check browser console for errors
- Verify data was inserted in Supabase dashboard
- Check that auth.uid() matches the user inserting data

### "Row level security violation"
- Verify RLS policies exist in Supabase
- Make sure user is authenticated (check `supabase.auth.getUser()`)
- Check that user_id matches the authenticated user's ID

### Hook called conditionally
- Don't call hooks inside conditionals or loops
- Move hook calls to top of component before any returns
