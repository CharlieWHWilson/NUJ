import { renderHook, waitFor, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useCheckin } from "./useCheckin";

const authStateChangeRef = vi.hoisted(() => ({
  callback: undefined as undefined | ((event: string, session: unknown) => void),
}));
const derivePresenceStatusMock = vi.hoisted(() => vi.fn());
const getCurrentUserIdMock = vi.hoisted(() => vi.fn());
const getLatestCheckinForUserMock = vi.hoisted(() => vi.fn());
const upsertCurrentUserCheckinMock = vi.hoisted(() => vi.fn());
const onAuthStateChangeMock = vi.hoisted(() =>
  vi.fn((callback: (event: string, session: unknown) => void) => {
    authStateChangeRef.callback = callback;
    return {
      data: {
        subscription: {
          unsubscribe: vi.fn(),
        },
      },
    };
  })
);

vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      onAuthStateChange: onAuthStateChangeMock,
    },
  },
}));

vi.mock("@/lib/supabaseData", () => ({
  derivePresenceStatus: derivePresenceStatusMock,
  getCurrentUserId: getCurrentUserIdMock,
  getLatestCheckinForUser: getLatestCheckinForUserMock,
  upsertCurrentUserCheckin: upsertCurrentUserCheckinMock,
}));
vi.mock("@/lib/dailyReminder", () => ({ recordLastCheckin: vi.fn() }));

describe("useCheckin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getCurrentUserIdMock.mockResolvedValue("user-1");
  });

  it("does not mark user checked in when save fails", async () => {
    getLatestCheckinForUserMock.mockResolvedValue(null);
    derivePresenceStatusMock.mockReturnValue("few-days");
    upsertCurrentUserCheckinMock.mockRejectedValue(new Error("save failed"));

    const { result } = renderHook(() => useCheckin("user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      const saved = await result.current.doCheckin();
      expect(saved).toBe(false);
    });

    expect(result.current.checkedIn).toBe(false);
    expect(result.current.error).toBe("save failed");
  });

  it("keeps user checked in for same-day record after reload", async () => {
    getLatestCheckinForUserMock.mockResolvedValue("2026-07-01T08:00:00.000Z");
    derivePresenceStatusMock.mockReturnValue("today");

    const { result } = renderHook(() => useCheckin("user-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.checkedIn).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("uses auth user fallback when currentUserId is unavailable", async () => {
    getLatestCheckinForUserMock.mockResolvedValue("2026-07-01T08:00:00.000Z");
    derivePresenceStatusMock.mockReturnValue("today");

    const { result } = renderHook(() => useCheckin(undefined));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(getCurrentUserIdMock).toHaveBeenCalled();
    expect(getLatestCheckinForUserMock).toHaveBeenCalledWith("user-1");
    expect(result.current.checkedIn).toBe(true);
  });

  it("re-syncs after auth state change when initial user lookup is unavailable", async () => {
    getCurrentUserIdMock
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("user-1");
    getLatestCheckinForUserMock.mockResolvedValue("2026-07-01T08:00:00.000Z");
    derivePresenceStatusMock.mockReturnValue("today");

    const { result } = renderHook(() => useCheckin(undefined));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.checkedIn).toBe(false);

    await act(async () => {
      authStateChangeRef.callback?.("SIGNED_IN", { user: { id: "user-1" } });
    });

    await waitFor(() => {
      expect(getLatestCheckinForUserMock).toHaveBeenCalledWith("user-1");
      expect(result.current.checkedIn).toBe(true);
    });
  });

  it("rechecks today's status when returning to the app", async () => {
    getLatestCheckinForUserMock.mockResolvedValue("2026-07-01T08:00:00Z");
    derivePresenceStatusMock.mockReturnValue("today");
    const { result } = renderHook(() => useCheckin("user-1"));
    await waitFor(() => expect(result.current.checkedIn).toBe(true));
    derivePresenceStatusMock.mockReturnValue("yesterday");
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await waitFor(() => expect(result.current.checkedIn).toBe(false));
    expect(getLatestCheckinForUserMock).toHaveBeenCalledTimes(2);
  });

  it("rechecks status across local midnight without a screen remount", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 1, 23, 59, 59));
    getLatestCheckinForUserMock.mockResolvedValue("2026-07-01T08:00:00Z");
    derivePresenceStatusMock.mockReturnValue("today");
    const { result, unmount } = renderHook(() => useCheckin("user-1"));
    await act(async () => {});
    expect(result.current.checkedIn).toBe(true);
    derivePresenceStatusMock.mockReturnValue("yesterday");
    await act(async () => { vi.advanceTimersByTime(1100); });
    expect(result.current.checkedIn).toBe(false);
    unmount();
    vi.useRealTimers();
  });
});
