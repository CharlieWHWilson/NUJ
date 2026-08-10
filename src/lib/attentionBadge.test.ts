import { describe, expect, it } from "vitest";
import { calculateAttentionBadgeCount } from "./attentionBadge";

describe("calculateAttentionBadgeCount", () => {
  it("does not add a reminder badge when the user has already checked in today", () => {
    const count = calculateAttentionBadgeCount({
      unreadCount: 0,
      checkedInToday: true,
      reminderEnabled: true,
      reminderTime: "09:00",
      now: new Date("2026-08-10T09:30:00"),
    });

    expect(count).toBe(0);
  });

  it("adds the reminder badge when the reminder is due and the user has not checked in", () => {
    const count = calculateAttentionBadgeCount({
      unreadCount: 0,
      checkedInToday: false,
      reminderEnabled: true,
      reminderTime: "09:00",
      now: new Date("2026-08-10T09:30:00"),
    });

    expect(count).toBe(1);
  });

  it("adds both the reminder badge and unread NUJ count when both are present", () => {
    const count = calculateAttentionBadgeCount({
      unreadCount: 2,
      checkedInToday: false,
      reminderEnabled: true,
      reminderTime: "09:00",
      now: new Date("2026-08-10T09:30:00"),
    });

    expect(count).toBe(3);
  });
});
