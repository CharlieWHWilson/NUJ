import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Group } from "@/data/mockData";

const isMissingGroupMatesTableError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;

  const maybeError = error as { code?: unknown; message?: unknown };
  const message = typeof maybeError.message === "string" ? maybeError.message : "";

  return maybeError.code === "PGRST205" && message.includes("public.group_mates");
};

const toGroupError = (error: unknown) => {
  if (isMissingGroupMatesTableError(error)) {
    return new Error("Database schema is missing public.group_mates. Run migration 015_ensure_group_mates_table.sql and retry.");
  }

  return error instanceof Error ? error : new Error("Group operation failed");
};

export const useGroupsSupabase = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setGroups([]);
        setLoading(false);
        return;
      }

      const { data: groupsData, error: groupsError } = await supabase
        .from("groups")
        .select("*")
        .eq("user_id", userData.user.id)
        .order("name");

      if (groupsError) throw groupsError;

      const groupsWithMates: Group[] = await Promise.all(
        (groupsData || []).map(async (group: any) => {
          const { data: mateIds, error: matesError } = await supabase
            .from("group_mates")
            .select("mate_id")
            .eq("group_id", group.id);

          if (matesError) {
            if (isMissingGroupMatesTableError(matesError)) {
              return {
                id: group.id,
                name: group.name,
                mates: [],
              };
            }
            throw matesError;
          }

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
      const normalizedError = toGroupError(err);
      console.error("Error fetching groups:", normalizedError);
      setError(normalizedError.message);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

        if (linkError) throw toGroupError(linkError);
      }

      const newGroup: Group = {
        id: groupData.id,
        name: groupData.name,
        mates: mateIds,
      };

      setGroups((prev) => [...prev, newGroup]);
      return newGroup;
    } catch (err) {
      const normalizedError = toGroupError(err);
      console.error("Error adding group:", normalizedError);
      throw normalizedError;
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

        if (insertError) throw toGroupError(insertError);
      }

      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, mates: mateIds } : g))
      );
    } catch (err) {
      const normalizedError = toGroupError(err);
      console.error("Error updating group mates:", normalizedError);
      throw normalizedError;
    }
  };

  const updateGroup = async (groupId: string, updates: { name?: string; mateIds?: string[] }) => {
    try {
      if (updates.name !== undefined) {
        const { error: nameError } = await supabase
          .from("groups")
          .update({ name: updates.name })
          .eq("id", groupId);

        if (nameError) throw nameError;
      }

      if (updates.mateIds !== undefined) {
        await updateGroupMates(groupId, updates.mateIds);
      } else {
        setGroups((prev) =>
          prev.map((group) =>
            group.id === groupId
              ? { ...group, ...(updates.name !== undefined ? { name: updates.name } : {}) }
              : group
          )
        );
      }
    } catch (err) {
      console.error("Error updating group:", err);
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
    updateGroup,
    refresh,
  };
};
