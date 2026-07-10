import { describe, expect, it, vi, beforeEach } from "vitest";

const supabaseState = vi.hoisted(() => ({
  currentUserId: "user-a",
  matesByUserId: {} as Record<string, Array<{
    id: string;
    user_id: string;
    mate_user_id: string | null;
    name: string;
    initials: string;
    last_checkin?: "today" | "yesterday" | "few-days" | null;
    days_since_checkin?: number | null;
  }>>,
  profilesByUsername: [] as Array<{ id: string; username: string }>,
  profilesById: {} as Record<string, { id: string; username?: string; last_checkin_at?: string | null }>,
  profileIdLookups: [] as Array<string>,
  checkinsByUserId: [] as Array<{ user_id: string; checked_in_at: string }>,
  mateUpdates: [] as Array<{ id?: string; user_id?: string; mate_user_id?: string }>,
}));

const supabaseMock = vi.hoisted(() => {
  const auth = {
    getUser: vi.fn(async () => ({ data: { user: { id: supabaseState.currentUserId } }, error: null })),
  };

  const from = vi.fn((table: string) => {
    const query: any = {
      _table: table,
      _select: undefined as string | undefined,
      _filters: [] as Array<{ op: string; field: string; value: any }>,
      _order: undefined as { field: string; ascending: boolean } | undefined,
      _limit: undefined as number | undefined,
      _updatePayload: undefined as any,

      select(selection: string) {
        this._select = selection;
        return this;
      },

      eq(field: string, value: any) {
        this._filters.push({ op: "eq", field, value });
        return this;
      },

      ilike(field: string, value: any) {
        this._filters.push({ op: "ilike", field, value });
        return this;
      },

      in(field: string, value: any) {
        this._filters.push({ op: "in", field, value });
        return this;
      },

      order(field: string, options?: { ascending?: boolean }) {
        this._order = { field, ascending: options?.ascending ?? true };
        return this;
      },

      limit(value: number) {
        this._limit = value;
        return this;
      },

      update(payload: any) {
        this._updatePayload = payload;
        return this;
      },

      then(resolve: (result: { data: any; error: any }) => unknown) {
        return Promise.resolve(executeQuery(this)).then(resolve);
      },

      maybeSingle() {
        return Promise.resolve(executeQuery(this)).then((result) => ({
          data: Array.isArray(result.data) ? result.data[0] ?? null : result.data ?? null,
          error: result.error,
        }));
      },
    };

    return query;
  });

  const executeQuery = async (query: any) => {
    if (query._updatePayload && query._table === "mates") {
      supabaseState.mateUpdates.push(query._updatePayload);
      return { data: null, error: null };
    }

    if (query._table === "mates") {
      const userFilter = query._filters.find((filter: any) => filter.field === "user_id" && filter.op === "eq");
      return { data: supabaseState.matesByUserId[userFilter?.value ?? ""] ?? [], error: null };
    }

    if (query._table === "profiles") {
      const inFilter = query._filters.find((filter: any) => filter.field === "id" && filter.op === "in");
      const eqFilter = query._filters.find((filter: any) => filter.field === "username" && filter.op === "eq");
      const idEqFilter = query._filters.find((filter: any) => filter.field === "id" && filter.op === "eq");
      const ilikeFilter = query._filters.find((filter: any) => filter.field === "username" && filter.op === "ilike");

      if (idEqFilter) {
        supabaseState.profileIdLookups.push(String(idEqFilter.value));
      }

      if (inFilter) {
        const ids = Array.isArray(inFilter.value) ? inFilter.value : [];
        const rows = ids
          .map((id: string) => supabaseState.profilesById[id])
          .filter(Boolean);
        return { data: rows, error: null };
      }

      const matches = supabaseState.profilesByUsername.filter((profile) => {
        if (eqFilter) {
          return profile.username === eqFilter.value;
        }

        if (ilikeFilter) {
          const needle = String(ilikeFilter.value).toLowerCase();
          if (needle.includes("%")) {
            const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(`^${escaped.replace(/%/g, ".*")}$`, "i");
            return regex.test(profile.username);
          }
          return profile.username.toLowerCase() === needle;
        }

        return false;
      });

      return { data: query._limit ? matches.slice(0, query._limit) : matches, error: null };
    }

    if (query._table === "checkins") {
      const inFilter = query._filters.find((filter: any) => filter.field === "user_id" && filter.op === "in");
      const userIds = Array.isArray(inFilter?.value) ? inFilter.value : [];
      return {
        data: supabaseState.checkinsByUserId.filter((row) => userIds.includes(row.user_id)),
        error: null,
      };
    }

    return { data: [], error: null };
  };

  return { auth, from };
});

vi.mock("@/lib/supabase", () => ({
  supabase: supabaseMock,
}));

import { derivePresenceStatus, fetchCurrentUserMates, searchProfileById } from "./supabaseData";

describe("derivePresenceStatus", () => {
  it("returns today for a check-in from the current day", () => {
    const now = new Date("2026-07-01T12:00:00.000Z");
    expect(derivePresenceStatus("2026-07-01T10:00:00.000Z", now)).toBe("today");
  });

  it("returns yesterday for a check-in from the previous day", () => {
    const now = new Date("2026-07-01T12:00:00.000Z");
    expect(derivePresenceStatus("2026-06-30T10:00:00.000Z", now)).toBe("yesterday");
  });

  it("returns few-days for older check-ins", () => {
    const now = new Date("2026-07-01T12:00:00.000Z");
    expect(derivePresenceStatus("2026-06-25T10:00:00.000Z", now)).toBe("few-days");
  });
});

describe("fetchCurrentUserMates", () => {
  beforeEach(() => {
    supabaseState.currentUserId = "user-a";
    supabaseState.matesByUserId = {
      "user-a": [
        {
          id: "mate-lyra",
          user_id: "user-a",
          mate_user_id: null,
          name: "Lyra Wilson",
          initials: "LW",
        },
      ],
    };
    supabaseState.profilesByUsername = [
      { id: "user-b", username: "lyra wilson" },
    ];
    supabaseState.profilesById = {
      "user-b": { id: "user-b", username: "Lyra Wilson", last_checkin_at: null },
    };
    supabaseState.checkinsByUserId = [
      { user_id: "user-b", checked_in_at: new Date().toISOString() },
    ];
    supabaseState.profileIdLookups = [];
    supabaseState.mateUpdates = [];
    vi.clearAllMocks();
  });

  it("does not fall back to a profiles.id lookup for a non-UUID NUJ code", async () => {
    supabaseState.profilesByUsername = [];

    const profile = await searchProfileById("AGGL0TS");

    expect(profile).toBeNull();
    expect(supabaseState.profileIdLookups).toHaveLength(0);
  });

  it("uses a case-insensitive profile match so a checked-in mate does not fall back to three days ago", async () => {
    const mates = await fetchCurrentUserMates();

    expect(mates).toHaveLength(1);
    expect(mates[0].lastCheckin).toBe("today");
    expect(mates[0].daysSinceCheckin).toBe(0);
    expect(mates[0].lastCheckinAt).toBeTruthy();
    expect(supabaseState.mateUpdates).toContainEqual({ mate_user_id: "user-b" });
  });

  it("falls back to mates presence fields when direct checkin timestamps are unavailable", async () => {
    supabaseState.matesByUserId = {
      "user-a": [
        {
          id: "mate-lyra",
          user_id: "user-a",
          mate_user_id: null,
          name: "Lyra Wilson",
          initials: "LW",
          last_checkin: "today",
          days_since_checkin: 0,
        },
      ],
    };
    supabaseState.profilesByUsername = [];
    supabaseState.checkinsByUserId = [];

    const mates = await fetchCurrentUserMates();

    expect(mates).toHaveLength(1);
    expect(mates[0].lastCheckin).toBe("today");
    expect(mates[0].daysSinceCheckin).toBe(0);
    expect(mates[0].lastCheckinAt).toBeUndefined();
  });

  it("uses profiles.last_checkin_at when checkins rows are unavailable", async () => {
    const latest = new Date().toISOString();
    supabaseState.matesByUserId = {
      "user-a": [
        {
          id: "mate-lyra",
          user_id: "user-a",
          mate_user_id: "user-b",
          name: "Lyra Wilson",
          initials: "LW",
          last_checkin: "few-days",
          days_since_checkin: 3,
        },
      ],
    };
    supabaseState.checkinsByUserId = [];
    supabaseState.profilesById = {
      "user-b": { id: "user-b", username: "Lyra Wilson", last_checkin_at: latest },
    };

    const mates = await fetchCurrentUserMates();

    expect(mates).toHaveLength(1);
    expect(mates[0].lastCheckin).toBe("today");
    expect(mates[0].daysSinceCheckin).toBe(0);
    expect(mates[0].lastCheckinAt).toBe(latest);
  });

  it("resolves legacy mate names with inconsistent spacing to the correct profile", async () => {
    const latest = new Date().toISOString();
    supabaseState.matesByUserId = {
      "user-a": [
        {
          id: "mate-lyra",
          user_id: "user-a",
          mate_user_id: null,
          name: "Lyra   Wilson",
          initials: "LW",
          last_checkin: "few-days",
          days_since_checkin: 3,
        },
      ],
    };
    supabaseState.profilesByUsername = [
      { id: "user-b", username: "Lyra Wilson" },
    ];
    supabaseState.profilesById = {
      "user-b": { id: "user-b", username: "Lyra Wilson", last_checkin_at: latest },
    };
    supabaseState.checkinsByUserId = [];

    const mates = await fetchCurrentUserMates();

    expect(mates).toHaveLength(1);
    expect(mates[0].mateUserId).toBe("user-b");
    expect(mates[0].lastCheckin).toBe("today");
    expect(mates[0].daysSinceCheckin).toBe(0);
    expect(mates[0].lastCheckinAt).toBe(latest);
  });
});
