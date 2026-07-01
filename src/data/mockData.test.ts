import { afterEach, describe, expect, it, vi } from "vitest";
import { presenceLabel } from "./mockData";

describe("presenceLabel", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns hour-level label for same-day timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T12:00:00.000Z"));

    expect(presenceLabel("today", 0, "2026-07-01T10:00:00.000Z")).toBe("2h ago");
  });

  it("returns day-level label for older timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-06T12:00:00.000Z"));

    expect(presenceLabel("few-days", 5, "2026-07-01T10:00:00.000Z")).toBe("5 days ago");
  });

  it("falls back to day bucket when no timestamp is provided", () => {
    expect(presenceLabel("yesterday", 1)).toBe("Yesterday");
  });
});
