import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGroupsSupabase } from "./useGroupsSupabase";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: "owner" } } }) },
  rpc: mocks.rpc, from: mocks.from,
} }));

describe("personal group persistence", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    mocks.rpc.mockResolvedValue({ data: "group", error: null });
    mocks.from.mockReset();
    mocks.from.mockImplementation((table: string) => {
      const query = {
        select: () => query, eq: () => query, order: () => query,
        then: (resolve: (result: unknown) => unknown) => Promise.resolve({
          data: table === "groups" ? [{ id: "group", name: "School", checkin_cadence_days: 7 }] : [{ mate_id: "mate-1" }], error: null,
        }).then(resolve),
      };
      return query;
    });
  });

  it("updates the name and mates together from one successful transaction", async () => {
    const { result } = renderHook(() => useGroupsSupabase());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.updateGroup("group", { name: "New school", mateIds: ["mate-2"] }); });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith("save_personal_group", { p_group_id: "group", p_name: "New school", p_mate_ids: ["mate-2"] });
    expect(result.current.groups[0]).toMatchObject({ name: "New school", mates: ["mate-2"], checkinCadenceDays: 7 });
  });

  it("leaves the original local group intact on a failed save", async () => {
    const { result } = renderHook(() => useGroupsSupabase());
    await waitFor(() => expect(result.current.loading).toBe(false));
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: "Save failed" } });
    await act(async () => { await expect(result.current.updateGroup("group", { name: "Changed", mateIds: [] })).rejects.toThrow("Save failed"); });
    expect(result.current.groups[0]).toMatchObject({ name: "School", mates: ["mate-1"] });
  });

  it("does not add a phantom group when the migration is missing", async () => {
    const { result } = renderHook(() => useGroupsSupabase());
    await waitFor(() => expect(result.current.loading).toBe(false));
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202" } });
    await act(async () => { await expect(result.current.addGroup("New", ["mate-1"])).rejects.toThrow("038_atomic_personal_groups.sql"); });
    expect(result.current.groups).toHaveLength(1);
  });
});