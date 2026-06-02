/**
 * Example: Refactoring MatesHub to use Supabase
 * 
 * This is a reference implementation showing how to migrate a page
 * from localStorage/mockData to Supabase hooks.
 * 
 * BEFORE: Uses mockData.mates and local state
 * AFTER: Uses useMatesSupabase hook with real Supabase data
 */

import React, { useState } from "react";
import { useMatesSupabase } from "@/hooks/useMatesSupabase";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { TopNav } from "@/components/TopNav";
import { MateRow } from "@/components/MateComponents";
import { AddMateSheet } from "@/components/AddMateSheet";

export const MatesHubSupabase = () => {
  // Get mates from Supabase
  const { mates, loading, error, removeMate } = useMatesSupabase();
  const user = useCurrentUser();
  const [addMateOpen, setAddMateOpen] = useState(false);

  // Handle loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background max-w-md mx-auto flex items-center justify-center">
        <p className="text-muted-foreground">Loading your mates...</p>
      </div>
    );
  }

  // Handle error state
  if (error) {
    return (
      <div className="min-h-screen bg-background max-w-md mx-auto flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 font-medium">Error loading mates</p>
          <p className="text-sm text-muted-foreground mt-2">{error}</p>
        </div>
      </div>
    );
  }

  // Handle empty state
  if (mates.length === 0) {
    return (
      <div className="min-h-screen bg-background max-w-md mx-auto">
        <TopNav onAddMate={() => setAddMateOpen(true)} />
        <div className="px-5 py-20 text-center">
          <p className="text-muted-foreground">No mates yet</p>
          <button
            onClick={() => setAddMateOpen(true)}
            className="mt-4 nuj-btn-primary px-4 py-2"
          >
            Add your first mate
          </button>
        </div>
        <AddMateSheet open={addMateOpen} onOpenChange={setAddMateOpen} />
      </div>
    );
  }

  // Render mates from Supabase
  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      <TopNav onAddMate={() => setAddMateOpen(true)} />
      
      <div className="px-5 py-4 space-y-2">
        <h1 className="text-2xl font-bold">Your Mates ({mates.length})</h1>
        
        <div className="space-y-2 mt-4">
          {mates.map((mate) => (
            <MateRow
              key={mate.id}
              mate={mate}
              onRemove={() => removeMate(mate.id)}
              clickable={true}
            />
          ))}
        </div>
      </div>

      <AddMateSheet open={addMateOpen} onOpenChange={setAddMateOpen} />
    </div>
  );
};

/**
 * KEY CHANGES:
 * 
 * 1. Import useMatesSupabase instead of mockData:
 *    OLD: import { mates } from "@/data/mockData";
 *    NEW: import { useMatesSupabase } from "@/hooks/useMatesSupabase";
 * 
 * 2. Call the hook to get mates and actions:
 *    const { mates, loading, error, removeMate } = useMatesSupabase();
 * 
 * 3. Add loading and error states:
 *    if (loading) return <Loading />;
 *    if (error) return <Error />;
 * 
 * 4. Mates are now automatically synced with Supabase:
 *    - Adding a mate in AddMateSheet updates here automatically
 *    - Removing a mate calls Supabase delete and updates state
 *    - Refreshing page fetches latest data from Supabase
 * 
 * 5. Actions now work with Supabase:
 *    OLD: removeMateFron localStorage
 *    NEW: removeMate() calls Supabase and updates state
 * 
 * BENEFITS:
 * - Data persists across browser sessions and devices
 * - Real-time sync when user logs in with different account
 * - Proper user isolation via RLS policies
 * - Ready for Vercel deployment
 */
