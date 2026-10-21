import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Group, Mate } from "@/data/mockData";

export const DEFAULT_CHECKIN_CADENCE_DAYS = 1;
// Must match the groups_checkin_cadence_days_range constraint; 30 represents "every month".
export const CHECKIN_CADENCE_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 14, 21, 30];

export const formatCheckinCadence = (days: number) => {
  if (days === 1) return "Every day";
  if (days === 7) return "Every week";
  if (days === 30) return "Every month";
  if (days % 7 === 0) return `Every ${days / 7} weeks`;
  return `Every ${days} days`;
};

export const getDaysSinceCheckin = (mate: Pick<Mate, "lastCheckin" | "daysSinceCheckin">) => {
  if (typeof mate.daysSinceCheckin === "number") return mate.daysSinceCheckin;
  if (mate.lastCheckin === "today") return 0;
  if (mate.lastCheckin === "yesterday") return 1;
  return 3;
};

export const isWithinCheckinCadence = (
  mate: Pick<Mate, "lastCheckin" | "daysSinceCheckin">,
  cadenceDays: number,
) => getDaysSinceCheckin(mate) < cadenceDays;

const toCadenceDays = (value: unknown) =>
  CHECKIN_CADENCE_OPTIONS.includes(value as number) ? (value as number) : DEFAULT_CHECKIN_CADENCE_DAYS;

const persistPersonalGroup = async (id: string | null, name: string, mateIds: string[]): Promise<string> => {
  const { data, error } = await supabase.rpc("save_personal_group", { p_group_id: id, p_name: name, p_mate_ids: mateIds });
  if (error) throw new Error(error.code === "PGRST202"
    ? "Personal group saving needs Supabase migration 038_atomic_personal_groups.sql."
    : error.message || "Couldn't save this personal group.");
  if (typeof data !== "string") throw new Error("Couldn't confirm the saved personal group.");
  return data;
};

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
        (groupsData || []).map(async (group: { id: string; name: string; checkin_cadence_days?: number }) => {
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
                checkinCadenceDays: toCadenceDays(group.checkin_cadence_days),
              };
            }
            throw matesError;
          }

          return {
            id: group.id,
            name: group.name,
            mates: (mateIds || []).map((mate: { mate_id: string }) => mate.mate_id),
            checkinCadenceDays: toCadenceDays(group.checkin_cadence_days),
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
      const groupId = await persistPersonalGroup(null, groupName, mateIds);

      const newGroup: Group = {
        id: groupId,
        name: groupName.trim(),
        mates: [...new Set(mateIds)],
        checkinCadenceDays: DEFAULT_CHECKIN_CADENCE_DAYS,
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

  const updateGroup = async (groupId: string, updates: { name?: string; mateIds?: string[] }) => {
    const existing = groups.find((group) => group.id === groupId);
    if (!existing) throw new Error("This personal group is unavailable.");
    const name = (updates.name ?? existing.name).trim();
    const mateIds = [...new Set(updates.mateIds ?? existing.mates)];
    await persistPersonalGroup(groupId, name, mateIds);
    setGroups((previous) => previous.map((group) => group.id === groupId ? { ...group, name, mates: mateIds } : group));
  };

  const updateGroupMates = (groupId: string, mateIds: string[]) => updateGroup(groupId, { mateIds });

  const updateGroupCadence = async (groupId: string, cadenceDays: number) => {
    const { error: cadenceError } = await supabase
      .from("groups")
      .update({ checkin_cadence_days: cadenceDays })
      .eq("id", groupId);

    if (cadenceError) {
      console.error("Error updating group cadence:", cadenceError);
      throw cadenceError;
    }

    setGroups((prev) =>
      prev.map((group) => (group.id === groupId ? { ...group, checkinCadenceDays: cadenceDays } : group))
    );
  };

  return {
    groups,
    loading,
    error,
    addGroup,
    removeGroup,
    updateGroupMates,
    updateGroup,
    updateGroupCadence,
    refresh,
  };
};
