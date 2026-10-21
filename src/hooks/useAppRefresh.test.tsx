import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppRefresh } from "./useAppRefresh";

const native = vi.hoisted(() => ({ enabled: false, callback: null as null | ((state: { isActive: boolean }) => void), remove: vi.fn() }));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => native.enabled } }));
vi.mock("@capacitor/app", () => ({ App: { addListener: (_event: string, callback: typeof native.callback) => {
  native.callback = callback;
  return Promise.resolve({ remove: native.remove });
} } }));

describe("app refresh lifecycle", () => {
  beforeEach(() => {
    native.enabled = false;
    native.callback = null;
    native.remove.mockClear();
  });
  afterEach(() => vi.restoreAllMocks());

  it("refreshes on browser focus and push events and uses the latest callback", async () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ callback }) => useAppRefresh(callback), { initialProps: { callback: first } });
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(first).toHaveBeenCalledOnce();
    rerender({ callback: second });
    await act(async () => { window.dispatchEvent(new Event("nuj:refresh")); });
    expect(second).toHaveBeenCalledOnce();
    expect(first).toHaveBeenCalledOnce();
  });

  it("does not poll a hidden screen and removes listeners on unmount", async () => {
    const callback = vi.fn();
    const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    const { unmount } = renderHook(() => useAppRefresh(callback));
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(callback).not.toHaveBeenCalled();
    hidden.mockReturnValue(false);
    await act(async () => { document.dispatchEvent(new Event("visibilitychange")); });
    expect(callback).toHaveBeenCalledOnce();
    unmount();
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(callback).toHaveBeenCalledOnce();
  });

  it("refreshes on native resume and cleans up the native listener", async () => {
    native.enabled = true;
    const callback = vi.fn();
    const { unmount } = renderHook(() => useAppRefresh(callback));
    await act(async () => { native.callback?.({ isActive: false }); });
    expect(callback).not.toHaveBeenCalled();
    await act(async () => { native.callback?.({ isActive: true }); });
    expect(callback).toHaveBeenCalledOnce();
    await act(async () => { unmount(); });
    expect(native.remove).toHaveBeenCalledOnce();
  });
});