import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useNujsSupabase } from "./useNujsSupabase";

type QueryResult<T = any> = {
  data: T;
  error: any;
};

type SupabaseState = {
  currentUserId: string;
  nujs: Array<{
    id: string;
    sender_user_id: string;
    recipient_user_id: string;
    created_at: string;
  }>;
  matesByUserId: Record<
    string,
    Array<{
      id: string;
      mate_user_id: string | null;
      name: string;
      initials: string;
    }>
  >;
  profilesById: Record<string, { id: string; username: string }>;
};

const state = vi.hoisted<SupabaseState>(() => ({
  currentUserId: "user-a",
  nujs: [],
  matesByUserId: {},
  profilesById: {},
}));

const makeResult = <T,>(data: T, error: any = null): QueryResult<T> => ({ data, error });

const supabaseMock = vi.hoisted(() => {
  const auth = {
    getUser: vi.fn(async () => makeResult({ user: { id: state.currentUserId } })),
  };

  const from = vi.fn((table: string) => {
    const query: any = {
      _table: table,
      _select: undefined as string | undefined,
      _filters: [] as Array<{ op: string; field: string; value: any }>,
      _order: undefined as { field: string; ascending: boolean } | undefined,
      _insertPayload: undefined as any,
      _delete: false,

      select(selection: string) {
        this._select = selection;
        return this;
      },

      eq(field: string, value: any) {
        this._filters.push({ op: "eq", field, value });
        return this;
      },

      in(field: string, values: any[]) {
        this._filters.push({ op: "in", field, value: values });
        return this;
      },

      order(field: string, options?: { ascending?: boolean }) {
        this._order = { field, ascending: options?.ascending ?? true };
        return this;
      },

      insert(payload: any) {
        this._insertPayload = payload;

        if (table === "nujs") {
          const rows = Array.isArray(payload) ? payload : [payload];
          for (const row of rows) {
            state.nujs.unshift({
              id: `n-${state.nujs.length + 1}`,
              sender_user_id: row.sender_user_id,
              recipient_user_id: row.recipient_user_id,
              created_at: "2026-07-01T10:00:00.000Z",
            });
          }
        }

        return this;
      },

      delete() {
        this._delete = true;
        return this;
      },

      single: vi.fn(async function () {
        if (table === "nujs" && this._insertPayload) {
          return makeResult(state.nujs[0]);
        }
        return makeResult(null);
      }),

      then: async function (resolve: (result: QueryResult) => unknown) {
        const result = await executeQuery(this);
        return resolve(result);
      },
    };

    return query;
  });

  const executeQuery = async (query: any): Promise<QueryResult> => {
    const table = query._table;

    if (query._delete && table === "nujs") {
      const idFilter = query._filters.find((f: any) => f.field === "id");
      if (idFilter) {
        state.nujs = state.nujs.filter((row) => row.id !== idFilter.value);
      }
      return makeResult(null);
    }

    if (table === "mates") {
      const userFilter = query._filters.find((f: any) => f.field === "user_id");
      const rows = state.matesByUserId[userFilter?.value ?? ""] ?? [];
      return makeResult(rows);
    }

    if (table === "nujs") {
      let rows = [...state.nujs];

      for (const filter of query._filters) {
        if (filter.op === "eq") {
          rows = rows.filter((row) => (row as any)[filter.field] === filter.value);
        }
      }

      if (query._order?.field === "created_at") {
        rows.sort((a, b) => {
          if (query._order.ascending) {
            return a.created_at.localeCompare(b.created_at);
          }
          return b.created_at.localeCompare(a.created_at);
        });
      }

      return makeResult(rows);
    }

    if (table === "profiles") {
      const inFilter = query._filters.find((f: any) => f.op === "in" && f.field === "id");
      const ids: string[] = inFilter?.value ?? [];
      const profiles = ids
        .map((id) => state.profilesById[id])
        .filter((profile): profile is { id: string; username: string } => Boolean(profile));
      return makeResult(profiles);
    }

    return makeResult([]);
  };

  return { auth, from };
});

vi.mock("@/lib/supabase", () => ({
  supabase: supabaseMock,
}));

describe("useNujsSupabase", () => {
  beforeEach(() => {
    state.currentUserId = "user-a";
    state.nujs = [];
    state.matesByUserId = {
      "user-a": [
        { id: "mate-b", mate_user_id: "user-b", name: "User B", initials: "UB" },
      ],
      "user-b": [
        { id: "mate-a", mate_user_id: "user-a", name: "User A", initials: "UA" },
      ],
    };
    state.profilesById = {
      "user-a": { id: "user-a", username: "User A" },
      "user-b": { id: "user-b", username: "User B" },
    };
    vi.clearAllMocks();
  });

  it("sender sends NUJ and sees it in outbox", async () => {
    const { result } = renderHook(() => useNujsSupabase());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.sendNuj("user-b");
    });

    expect(result.current.nujsSent).toHaveLength(1);
    expect(result.current.nujsSent[0].toMateName).toBe("User B");
  });

  it("recipient sees NUJ in inbox after login", async () => {
    state.nujs = [
      {
        id: "n-1",
        sender_user_id: "user-a",
        recipient_user_id: "user-b",
        created_at: "2026-07-01T10:00:00.000Z",
      },
    ];
    state.currentUserId = "user-b";

    const { result } = renderHook(() => useNujsSupabase());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.nujsReceived).toHaveLength(1);
    expect(result.current.nujsReceived[0].fromMateName).toBe("User A");
  });

  it("recipient can delete a received NUJ", async () => {
    state.nujs = [
      {
        id: "n-1",
        sender_user_id: "user-a",
        recipient_user_id: "user-b",
        created_at: "2026-07-01T10:00:00.000Z",
      },
    ];
    state.currentUserId = "user-b";

    const { result } = renderHook(() => useNujsSupabase());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.removeReceivedNuj("n-1");
    });

    expect(result.current.nujsReceived).toHaveLength(0);
  });
});
