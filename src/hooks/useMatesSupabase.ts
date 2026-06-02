import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Mate, PresenceStatus } from "@/data/mockData";

export const useMatesSupabase = () => {
  const [mates, setMates] = useState<Mate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMates = async () => {
      try {
        setLoading(true);
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          setMates([]);
          setLoading(false);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from("mates")
          .select("*")
          .eq("user_id", userData.user.id)
          .order("name");

        if (fetchError) throw fetchError;

        const formattedMates: Mate[] = (data || []).map((mate: any) => ({
          id: mate.id,
          name: mate.name,
          initials: mate.initials,
          lastCheckin: mate.last_checkin as PresenceStatus,
          daysSinceCheckin: mate.days_since_checkin || undefined,
        }));

        setMates(formattedMates);
        setError(null);
      } catch (err) {
        console.error("Error fetching mates:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch mates");
        setMates([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMates();
  }, []);

  const addMate = async (mate: Omit<Mate, "id">) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { data, error: insertError } = await supabase
        .from("mates")
        .insert({
          user_id: userData.user.id,
          name: mate.name,
          initials: mate.initials,
          last_checkin: mate.lastCheckin,
          days_since_checkin: mate.daysSinceCheckin,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const newMate: Mate = {
        id: data.id,
        name: data.name,
        initials: data.initials,
        lastCheckin: data.last_checkin,
        daysSinceCheckin: data.days_since_checkin,
      };

      setMates((prev) => [...prev, newMate]);
      return newMate;
    } catch (err) {
      console.error("Error adding mate:", err);
      throw err;
    }
  };

  const removeMate = async (mateId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from("mates")
        .delete()
        .eq("id", mateId);

      if (deleteError) throw deleteError;

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
    refresh: () => {
      setLoading(true);
      setError(null);
    },
  };
};
