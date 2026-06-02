import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Group } from "@/data/mockData";

export const useGroupsSupabase = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGroups = async () => {
      try {
        setLoading(true);
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          setGroups([]);
          setLoading(false);
          return;
        }

        // Fetch groups
        const { data: groupsData, error: groupsError } = await supabase
          .from("groups")
          .select("*")
          .eq("user_id", userData.user.id)
          .order("name");

        if (groupsError) throw groupsError;

        // For each group, fetch its mates
        const groupsWithMates: Group[] = await Promise.all(
          (groupsData || []).map(async (group: any) => {
            const { data: mateIds, error: matesError } = await supabase
              .from("group_mates")
              .select("mate_id")
              .eq("group_id", group.id);

            if (matesError) throw matesError;

            return {
              id: group.id,
              name: group.name,
              mates: (mateIds || []).map((m: any) => m.mate_id),
            };
          })
        );

        setGroups(groupsWithMates);
        setError(null);
      } catch (err) {
        console.error("Error fetching groups:", err);
        setError(err instanceof Error ? err.message : "Failed to fetch groups");
        setGroups([]);
      } finally {
        setLoading(false);
      }
    };

    fetchGroups();
  }, []);

  const addGroup = async (groupName: string, mateIds: string[]) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      // Create group
      const { data: groupData, error: createError } = await supabase
        .from("groups")
        .insert({
          user_id: userData.user.id,
          name: groupName,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Add mates to group
      if (mateIds.length > 0) {
        const { error: linkError } = await supabase
          .from("group_mates")
          .insert(
            mateIds.map((mateId) => ({
              group_id: groupData.id,
              mate_id: mateId,
            }))
          );

        if (linkError) throw linkError;
      }

      const newGroup: Group = {
        id: groupData.id,
        name: groupData.name,
        mates: mateIds,
      };

      setGroups((prev) => [...prev, newGroup]);
      return newGroup;
    } catch (err) {
      console.error("Error adding group:", err);
      throw err;
    }
  };

  const removeGroup = async (groupId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from("groups")
        .delete()
        .eq("id", groupId);

      if (deleteError) throw deleteError;

      setGroups((prev) => prev.filter((g) => g.id !== groupId));
    } catch (err) {
      console.error("Error removing group:", err);
      throw err;
    }
  };

  const updateGroupMates = async (groupId: string, mateIds: string[]) => {
    try {
      // Delete existing mate links
      const { error: deleteError } = await supabase
        .from("group_mates")
        .delete()
        .eq("group_id", groupId);

      if (deleteError) throw deleteError;

      // Add new mate links
      if (mateIds.length > 0) {
        const { error: insertError } = await supabase
          .from("group_mates")
          .insert(
            mateIds.map((mateId) => ({
              group_id: groupId,
              mate_id: mateId,
            }))
          );

        if (insertError) throw insertError;
      }

      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, mates: mateIds } : g))
      );
    } catch (err) {
      console.error("Error updating group mates:", err);
      throw err;
    }
  };

  return {
    groups,
    loading,
    error,
    addGroup,
    removeGroup,
    updateGroupMates,
    refresh: () => {
      setLoading(true);
      setError(null);
    },
  };
};
