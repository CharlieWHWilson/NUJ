import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Mate } from "@/data/mockData";
import { addCurrentUserMate, fetchCurrentUserMates } from "@/lib/supabaseData";
import { MATES_UPDATED_EVENT, removeMateConnection } from "@/lib/mateRequests";

export const useMatesSupabase = () => {
  const [mates, setMates] = useState<Mate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const fetchedMates = await fetchCurrentUserMates();
      setMates(fetchedMates);
      setError(null);
    } catch (err) {
      console.error("Error fetching mates:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch mates");
      setMates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handleCheckinUpdated = () => {
      void refresh();
    };

    window.addEventListener("nuj:checkin-updated", handleCheckinUpdated);
    window.addEventListener(MATES_UPDATED_EVENT, handleCheckinUpdated);

    return () => {
      window.removeEventListener("nuj:checkin-updated", handleCheckinUpdated);
      window.removeEventListener(MATES_UPDATED_EVENT, handleCheckinUpdated);
    };
  }, [refresh]);

  useEffect(() => {
    const handleFocus = () => {
      void refresh();
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        void refresh();
      }
    };

    const intervalId = window.setInterval(() => {
      void refresh();
    }, 60_000);

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refresh]);

  const addMate = async (mate: Omit<Mate, "id"> & { mateUserId: string }) => {
    try {
      return await addCurrentUserMate({
        mateUserId: mate.mateUserId,
        name: mate.name,
        initials: mate.initials,
      });
    } catch (err) {
      console.error("Error adding mate:", err);
      throw err;
    }
  };

  const removeMate = async (mateId: string) => {
    try {
      await removeMateConnection(mateId);

      setMates((prev) => prev.filter((m) => m.id !== mateId));
    } catch (err) {
      console.error("Error removing mate:", err);
      throw err;
    }
  };

  const updateMate = async (mateId: string, updates: Partial<Mate>) => {
    try {
      const { error: updateError } = await supabase
        .from("mates")
        .update({
          name: updates.name,
          initials: updates.initials,
          last_checkin: updates.lastCheckin,
          days_since_checkin: updates.daysSinceCheckin,
        })
        .eq("id", mateId);

      if (updateError) throw updateError;

      setMates((prev) =>
        prev.map((m) =>
          m.id === mateId ? { ...m, ...updates } : m
        )
      );
    } catch (err) {
      console.error("Error updating mate:", err);
      throw err;
    }
  };

  return {
    mates,
    loading,
    error,
    addMate,
    removeMate,
    updateMate,
    refresh,
  };
};
