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

interface ProfileCheckinRow {
  id: string;
  username?: string;
  last_checkin_at?: string | null;
}

type ProfileLookupResult = {
  id: string;
  username: string;
  user_code: string;
  email: string | null;
  phone: string | null;
};

type GetProfileByUserCodeRow = {
  user_id: string;
  username: string;
  user_code: string;
  email: string | null;
  phone: string | null;
};

const normalizePersonName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ");

const NUJ_CODE_PATTERN = /^[A-Z0-9]{7}$/;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

const getMostRecentTimestamp = (...timestamps: Array<string | null | undefined>): string | null => {
  let latestTimestamp: string | null = null;
  let latestTime = Number.NEGATIVE_INFINITY;

  for (const timestamp of timestamps) {
    if (!timestamp) continue;

    const parsedTime = new Date(timestamp).getTime();
    if (Number.isNaN(parsedTime)) continue;

    if (parsedTime > latestTime) {
      latestTime = parsedTime;
      latestTimestamp = timestamp;
    }
  }

  return latestTimestamp;
};

const isTimestampNewer = (candidate: string, baseline?: string): boolean => {
  if (!baseline) return true;

  const candidateTime = new Date(candidate).getTime();
  const baselineTime = new Date(baseline).getTime();

  if (!Number.isNaN(candidateTime) && !Number.isNaN(baselineTime)) {
    return candidateTime > baselineTime;
  }

  return candidate > baseline;
};

const fetchMateCheckins = async (mateUserIds: string[]): Promise<CheckinRow[]> => {
  if (mateUserIds.length === 0) return [];

  const { data: rpcRows, error: rpcError } = await supabase.rpc("get_relevant_mate_checkins", {
    p_mate_user_ids: mateUserIds,
  });

  if (!rpcError && Array.isArray(rpcRows)) {
    return rpcRows as CheckinRow[];
  }

  const { data: fallbackRows, error: fallbackError } = await supabase
    .from("checkins")
    .select("user_id, checked_in_at")
    .in("user_id", mateUserIds);

  if (fallbackError) {
    throw fallbackError;
  }

  return (fallbackRows || []) as CheckinRow[];
};

export const getCurrentUserId = async (): Promise<string | null> => {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
};

export const searchProfileById = async (
  userId: string
): Promise<ProfileLookupResult | null> => {
  const normalizedLookup = userId.trim().toUpperCase();

  if (!NUJ_CODE_PATTERN.test(normalizedLookup)) {
    return null;
  }

  const { data, error } = await supabase.rpc("get_profile_by_user_code", {
    p_user_code: normalizedLookup,
  });

  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as
    | GetProfileByUserCodeRow
    | null
    | undefined;

  if (!row) return null;

  return {
    id: row.user_id,
    username: row.username,
    user_code: row.user_code,
    email: row.email ?? null,
    phone: row.phone ?? null,
  };
};

const resolveProfileIdByUsername = async (username: string): Promise<string | null> => {
  const normalizedUsername = username.trim();
  if (!normalizedUsername) return null;

  const lookups = [
    supabase.from("profiles").select("id").eq("username", normalizedUsername).limit(2),
    supabase.from("profiles").select("id").ilike("username", normalizedUsername).limit(2),
  ];

  for (const lookup of lookups) {
    const { data, error } = await lookup;

    if (error) {
      throw error;
    }

    const matches = (data || []) as Array<{ id: string }>;
    if (matches.length === 1) {
      return matches[0].id;
    }
  }

  const loosePattern = `%${normalizedUsername.split(/\s+/).filter(Boolean).join("%")}%`;
  if (loosePattern !== "%%") {
    const { data: looseMatches, error: looseError } = await supabase
      .from("profiles")
      .select("id, username")
      .ilike("username", loosePattern)
      .limit(10);

    if (looseError) {
      throw looseError;
    }

    const canonical = normalizePersonName(normalizedUsername);
    const exactCanonicalMatches = ((looseMatches || []) as Array<{ id: string; username: string }>)
      .filter((profile) => normalizePersonName(profile.username) === canonical);

    if (exactCanonicalMatches.length === 1) {
      return exactCanonicalMatches[0].id;
    }
  }

  return null;
};

export const fetchCurrentUserMates = async (): Promise<Mate[]> => {
  const userId = await getCurrentUserId();
  if (!userId) {
    return [];
  }

  const debugCheckins =
    typeof window !== "undefined"
    && new URLSearchParams(window.location.search).get("debugCheckins") === "1";

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
    const resolvedMateUserId = await resolveProfileIdByUsername(legacyRow.name);

    if (!resolvedMateUserId) {
      continue;
    }

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
    checkinRows = await fetchMateCheckins(mateUserIds);

    if (debugCheckins) {
      console.log("[nuj] checkins payload", {
        mateUserIds,
        checkinRows,
      });
    }
  }

  const profileLastCheckinByUserId = new Map<string, string>();
  if (mateUserIds.length > 0) {
    const { data: profileCheckins, error: profileCheckinsError } = await supabase
      .from("profiles")
      .select("id, last_checkin_at")
      .in("id", mateUserIds);

    if (profileCheckinsError) {
      const message = profileCheckinsError.message.toLowerCase();
      if (!message.includes("last_checkin_at")) {
        throw profileCheckinsError;
      }
    } else {
      for (const row of (profileCheckins || []) as ProfileCheckinRow[]) {
        if (row.last_checkin_at) {
          profileLastCheckinByUserId.set(row.id, row.last_checkin_at);
        }
      }
    }
  }

  const latestCheckinsByUserId = new Map<string, string>();
  for (const row of checkinRows) {
    const existing = latestCheckinsByUserId.get(row.user_id);
    if (isTimestampNewer(row.checked_in_at, existing)) {
      latestCheckinsByUserId.set(row.user_id, row.checked_in_at);
    }
  }

  const toPresenceFromMateRow = (row: MateRow): { status: PresenceStatus; daysSince: number } => {
    if (typeof row.days_since_checkin === "number") {
      const safeDays = Math.max(0, row.days_since_checkin);
      if (safeDays <= 0) return { status: "today", daysSince: 0 };
      if (safeDays === 1) return { status: "yesterday", daysSince: 1 };
      return { status: "few-days", daysSince: safeDays };
    }

    if (row.last_checkin === "today") return { status: "today", daysSince: 0 };
    if (row.last_checkin === "yesterday") return { status: "yesterday", daysSince: 1 };
    return { status: "few-days", daysSince: 3 };
  };

  return mateRows.map((row) => {
    const checkedInAt = row.mate_user_id
      ? getMostRecentTimestamp(
        latestCheckinsByUserId.get(row.mate_user_id),
        profileLastCheckinByUserId.get(row.mate_user_id)
      )
      : null;

    if (debugCheckins) {
      console.log("[nuj] mate checkin resolution", {
        mateId: row.id,
        mateName: row.name,
        mateUserId: row.mate_user_id,
        resolvedCheckedInAt: checkedInAt,
      });
    }

    const fallbackPresence = toPresenceFromMateRow(row);
    const daysSinceCheckin = checkedInAt
      ? getDaysSinceCheckinFromTimestamp(checkedInAt)
      : fallbackPresence.daysSince;
    const presenceStatus = checkedInAt
      ? derivePresenceStatus(checkedInAt)
      : fallbackPresence.status;

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
      id: crypto.randomUUID(),
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

  const updateProfileLastCheckin = async () => {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ last_checkin_at: checkedInAt })
      .eq("id", userId);

    if (profileError) {
      const message = profileError.message.toLowerCase();
      if (!message.includes("last_checkin_at")) {
        throw profileError;
      }
    }
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
  if (!error) {
    await updateProfileLastCheckin();
    return;
  }

  const primaryMessage = error.message.toLowerCase();
  if (primaryMessage.includes("updated_at")) {
    error = await tryUpsert(fallbackPayloadWithoutUpdatedAt);
    if (!error) {
      await updateProfileLastCheckin();
      return;
    }
  }

  const fallbackMessage = error.message.toLowerCase();
  if (fallbackMessage.includes("checked_in_date")) {
    error = await tryUpsert(fallbackPayloadMinimal);
    if (!error) {
      await updateProfileLastCheckin();
      return;
    }
  }

  const finalMessage = error.message.toLowerCase();
  if (finalMessage.includes("on conflict") || finalMessage.includes("unique") || finalMessage.includes("exclusion constraint")) {
    try {
      await writeWithoutUpsert(fallbackPayloadWithoutUpdatedAt);
      await updateProfileLastCheckin();
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
