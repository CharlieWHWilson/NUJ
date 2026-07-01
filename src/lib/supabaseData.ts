import { supabase } from "./supabase";
import type { Mate, PresenceStatus } from "@/data/mockData";

interface MateRow {
  id: string;
  user_id: string;
  mate_user_id?: string | null;
  name: string;
  initials: string;
  last_checkin?: PresenceStatus | null;
  days_since_checkin?: number | null;
}

interface CheckinRow {
  user_id: string;
  checked_in_at: string;
}

export const getDaysSinceCheckinFromTimestamp = (
  checkedInAt?: string | null,
  now = new Date()
): number => {
  if (!checkedInAt) return 3;

  const checkedInDate = new Date(checkedInAt);
  if (Number.isNaN(checkedInDate.getTime())) return 3;

  const nowDate = new Date(now);
  nowDate.setHours(0, 0, 0, 0);
  const normalizedCheckinDate = new Date(checkedInDate);
  normalizedCheckinDate.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (nowDate.getTime() - normalizedCheckinDate.getTime()) / 86_400_000
  );

  return Math.max(0, diffDays);
};

export const derivePresenceStatus = (
  checkedInAt?: string | null,
  now = new Date()
): PresenceStatus => {
  const daysSince = getDaysSinceCheckinFromTimestamp(checkedInAt, now);

  if (daysSince <= 0) return "today";
  if (daysSince === 1) return "yesterday";
  return "few-days";
};

export const getCurrentUserId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
};

export const searchProfileById = async (userId: string) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
};

export const fetchCurrentUserMates = async (): Promise<Mate[]> => {
  const userId = await getCurrentUserId();
  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("mates")
    .select("*")
    .eq("user_id", userId)
    .order("name");

  if (error) {
    throw error;
  }

  const mateRows = (data || []) as MateRow[];
  if (!mateRows.length) {
    return [];
  }

  // Repair legacy mate rows that were created before mate_user_id existed.
  // We only auto-link when there is a single exact username match in profiles.
  const legacyRows = mateRows.filter((row) => !row.mate_user_id);
  for (const legacyRow of legacyRows) {
    const { data: matchedProfiles, error: profileLookupError } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", legacyRow.name)
      .limit(2);

    if (profileLookupError || !matchedProfiles || matchedProfiles.length !== 1) {
      continue;
    }

    const resolvedMateUserId = matchedProfiles[0].id;
    legacyRow.mate_user_id = resolvedMateUserId;

    // Best effort persistence so future reads do not need fallback lookup.
    await supabase
      .from("mates")
      .update({ mate_user_id: resolvedMateUserId })
      .eq("id", legacyRow.id)
      .eq("user_id", userId);
  }

  const mateUserIds = mateRows
    .map((row) => row.mate_user_id)
    .filter((value): value is string => Boolean(value));

  let checkinRows: CheckinRow[] = [];
  if (mateUserIds.length > 0) {
    const { data: fetchedCheckins, error: checkinError } = await supabase
      .from("checkins")
      .select("user_id, checked_in_at")
      .in("user_id", mateUserIds);

    if (checkinError) {
      throw checkinError;
    }

    checkinRows = (fetchedCheckins || []) as CheckinRow[];
  }

  const latestCheckinsByUserId = new Map<string, string>();
  for (const row of checkinRows) {
    const existing = latestCheckinsByUserId.get(row.user_id);
    if (!existing || row.checked_in_at > existing) {
      latestCheckinsByUserId.set(row.user_id, row.checked_in_at);
    }
  }

  return mateRows.map((row) => {
    const checkedInAt = row.mate_user_id
      ? latestCheckinsByUserId.get(row.mate_user_id) ?? null
      : null;
    const daysSinceCheckin = getDaysSinceCheckinFromTimestamp(checkedInAt);
    const presenceStatus = derivePresenceStatus(checkedInAt);

    return {
      id: row.id,
      mateUserId: row.mate_user_id ?? undefined,
      name: row.name,
      initials: row.initials,
      lastCheckin: presenceStatus,
      daysSinceCheckin,
      lastCheckinAt: checkedInAt ?? undefined,
    } as Mate;
  });
};

export const addCurrentUserMate = async (params: {
  mateUserId: string;
  name: string;
  initials: string;
}) => {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Not authenticated");
  }

  const { data, error } = await supabase
    .from("mates")
    .insert({
      user_id: userId,
      mate_user_id: params.mateUserId,
      name: params.name,
      initials: params.initials,
      last_checkin: "few-days",
      days_since_checkin: 3,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as MateRow;
};

export const upsertCurrentUserCheckin = async (): Promise<void> => {
  const userId = await getCurrentUserId();
  if (!userId) {
    throw new Error("Not authenticated");
  }

  const checkedInAt = new Date().toISOString();
  const checkedInDate = checkedInAt.slice(0, 10);

  const primaryPayload = {
    user_id: userId,
    checked_in_at: checkedInAt,
    checked_in_date: checkedInDate,
    updated_at: checkedInAt,
  };

  const fallbackPayloadWithoutUpdatedAt = {
    user_id: userId,
    checked_in_at: checkedInAt,
    checked_in_date: checkedInDate,
  };

  const fallbackPayloadMinimal = {
    user_id: userId,
    checked_in_at: checkedInAt,
  };

  const tryUpsert = async (payload: Record<string, string>) => {
    const { error } = await supabase
      .from("checkins")
      .upsert(payload, { onConflict: "user_id" });
    return error;
  };

  const writeWithoutUpsert = async (payload: Record<string, string>) => {
    const { data: existingRow, error: fetchError } = await supabase
      .from("checkins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (fetchError) {
      throw new Error(fetchError.message || "Failed to read existing check-in row");
    }

    if (existingRow) {
      const { error: updateError } = await supabase
        .from("checkins")
        .update(payload)
        .eq("user_id", userId);

      if (updateError) {
        throw new Error(updateError.message || "Failed to update check-in row");
      }

      return;
    }

    const { error: insertError } = await supabase
      .from("checkins")
      .insert(payload);

    if (insertError) {
      throw new Error(insertError.message || "Failed to insert check-in row");
    }
  };

  let error = await tryUpsert(primaryPayload);
  if (!error) return;

  const primaryMessage = error.message.toLowerCase();
  if (primaryMessage.includes("updated_at")) {
    error = await tryUpsert(fallbackPayloadWithoutUpdatedAt);
    if (!error) return;
  }

  const fallbackMessage = error.message.toLowerCase();
  if (fallbackMessage.includes("checked_in_date")) {
    error = await tryUpsert(fallbackPayloadMinimal);
    if (!error) return;
  }

  const finalMessage = error.message.toLowerCase();
  if (finalMessage.includes("on conflict") || finalMessage.includes("unique") || finalMessage.includes("exclusion constraint")) {
    try {
      await writeWithoutUpsert(fallbackPayloadWithoutUpdatedAt);
      return;
    } catch (writeError) {
      throw writeError instanceof Error
        ? writeError
        : new Error("Check-in save failed in Supabase");
    }
  }

  const errorMessage =
    (error as { message?: string } | null)?.message
    ?? "Check-in save failed in Supabase";
  throw new Error(errorMessage);
};

export const getLatestCheckinForUser = async (userId: string) => {
  const { data, error } = await supabase
    .from("checkins")
    .select("checked_in_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.checked_in_at ?? null;
};

export const buildMateInitials = (name: string) => {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .toUpperCase();
};
