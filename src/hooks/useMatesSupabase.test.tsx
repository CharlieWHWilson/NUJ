import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useMatesSupabase } from "./useMatesSupabase";

const fetchCurrentUserMatesMock = vi.hoisted(() => vi.fn());
const addCurrentUserMateMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(),
    },
  },
}));

vi.mock("@/lib/supabaseData", () => ({
  addCurrentUserMate: addCurrentUserMateMock,
  fetchCurrentUserMates: fetchCurrentUserMatesMock,
}));

describe("useMatesSupabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("refreshes mates when a check-in update event is dispatched", async () => {
    fetchCurrentUserMatesMock
      .mockResolvedValueOnce([
        { id: "mate-1", name: "Bruno Wilson", initials: "BW", lastCheckin: "few-days", daysSinceCheckin: 3 },
      ])
      .mockResolvedValueOnce([
        { id: "mate-1", name: "Bruno Wilson", initials: "BW", lastCheckin: "today", daysSinceCheckin: 0 },
      ]);

    const { result } = renderHook(() => useMatesSupabase());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.mates[0]?.daysSinceCheckin).toBe(3);
    });

    await act(async () => {
      window.dispatchEvent(new Event("nuj:checkin-updated"));
    });

    await waitFor(() => {
      expect(fetchCurrentUserMatesMock).toHaveBeenCalledTimes(2);
      expect(result.current.mates[0]?.daysSinceCheckin).toBe(0);
    });
  });

  it("refreshes mates when the window regains focus", async () => {
    fetchCurrentUserMatesMock
      .mockResolvedValueOnce([
        { id: "mate-1", name: "Lyra Wilson", initials: "LW", lastCheckin: "few-days", daysSinceCheckin: 3 },
      ])
      .mockResolvedValueOnce([
        { id: "mate-1", name: "Lyra Wilson", initials: "LW", lastCheckin: "today", daysSinceCheckin: 0 },
      ]);

    const { result } = renderHook(() => useMatesSupabase());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.mates[0]?.daysSinceCheckin).toBe(3);
    });

    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });

    await waitFor(() => {
      expect(fetchCurrentUserMatesMock).toHaveBeenCalledTimes(2);
      expect(result.current.mates[0]?.daysSinceCheckin).toBe(0);
    });
  });

  it("refreshes mates on polling interval", async () => {
    vi.useFakeTimers();

    fetchCurrentUserMatesMock
      .mockResolvedValueOnce([
        { id: "mate-1", name: "Lyra Wilson", initials: "LW", lastCheckin: "few-days", daysSinceCheckin: 3 },
      ])
      .mockResolvedValueOnce([
        { id: "mate-1", name: "Lyra Wilson", initials: "LW", lastCheckin: "today", daysSinceCheckin: 0 },
      ]);

    renderHook(() => useMatesSupabase());

    await act(async () => {
      await Promise.resolve();
    });

    expect(fetchCurrentUserMatesMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(60_000);
      await Promise.resolve();
    });

    expect(fetchCurrentUserMatesMock).toHaveBeenCalledTimes(2);
  });
});