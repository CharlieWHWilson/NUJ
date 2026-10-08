import { describe, expect, it } from "vitest";
import { getUpcomingReminderDates, hasReminderIntervalElapsed } from "./dailyReminder";

describe("getUpcomingReminderDates", () => {
  it("returns the next slot today for daily reminders when the time hasn't passed", () => {
    const [next] = getUpcomingReminderDates("08:00", 1, null, new Date("2026-10-08T07:00:00"));
    expect(next).toEqual(new Date("2026-10-08T08:00:00"));
  });

  it("counts the interval from the last check-in", () => {
    const dates = getUpcomingReminderDates(
      "08:00",
      3,
      new Date("2026-10-08T12:00:00"),
      new Date("2026-10-08T13:00:00"),
      2,
    );
    expect(dates).toEqual([new Date("2026-10-11T08:00:00"), new Date("2026-10-14T08:00:00")]);
  });

  it("skips slots that have already passed", () => {
    const [next] = getUpcomingReminderDates(
      "08:00",
      2,
      new Date("2026-10-01T12:00:00"),
      new Date("2026-10-08T09:00:00"),
    );
    expect(next).toEqual(new Date("2026-10-09T08:00:00"));
  });
});

describe("hasReminderIntervalElapsed", () => {
  it("is always due for daily reminders", () => {
    expect(hasReminderIntervalElapsed(1, "2026-10-08T07:00:00", new Date("2026-10-08T09:00:00"))).toBe(true);
  });

  it("waits the chosen number of days after the last check-in", () => {
    const now = new Date("2026-10-10T09:00:00");
    expect(hasReminderIntervalElapsed(3, "2026-10-08T07:00:00", now)).toBe(false);
    expect(hasReminderIntervalElapsed(2, "2026-10-08T07:00:00", now)).toBe(true);
  });
});
