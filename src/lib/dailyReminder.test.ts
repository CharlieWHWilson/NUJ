import { beforeEach, describe, expect, it, vi } from "vitest";
import { getUpcomingReminderDates, hasReminderIntervalElapsed, scheduleDailyReminderNotification, scheduleInactivityReminder } from "./dailyReminder";

const native = vi.hoisted(() => ({
  enabled: false, cancel: vi.fn(), schedule: vi.fn(),
  checkPermissions: vi.fn(async () => ({ display: "granted" })),
  requestPermissions: vi.fn(async () => ({ display: "granted" })),
}));
vi.mock("@capacitor/core", () => ({ Capacitor: { isNativePlatform: () => native.enabled } }));
vi.mock("@capacitor/local-notifications", () => ({ LocalNotifications: native }));

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

describe("native reminder preferences", () => {
  let storage: Map<string, string>;
  beforeEach(() => {
    native.enabled = true;
    native.cancel.mockReset();
    native.schedule.mockReset();
    native.checkPermissions.mockClear();
    storage = new Map();
    Object.defineProperty(window, "localStorage", { configurable: true, value: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    } });
  });

  it("cancels every reminder including weekly inactivity when disabled", async () => {
    storage.set("nuj.daily_reminder", JSON.stringify({ enabled: false, time: "08:00", intervalDays: 1 }));
    await scheduleDailyReminderNotification();
    expect(native.cancel).toHaveBeenCalledWith({ notifications: expect.arrayContaining([{ id: 1001 }, { id: 1002 }, { id: 1101 }]) });
    expect(native.schedule).not.toHaveBeenCalled();
  });

  it("never schedules the inactivity reminder independently when the toggle is off", async () => {
    await scheduleInactivityReminder(new Date());
    expect(native.schedule).not.toHaveBeenCalled();
    expect(native.cancel).toHaveBeenCalledWith({ notifications: [{ id: 1002 }] });
  });

  it("schedules daily and inactivity reminders together only while enabled", async () => {
    storage.set("nuj.daily_reminder", JSON.stringify({ enabled: true, time: "08:00", intervalDays: 1 }));
    storage.set("nuj.last_checkin_at", new Date().toISOString());
    await scheduleDailyReminderNotification();
    expect(native.schedule).toHaveBeenCalledWith({ notifications: [expect.objectContaining({ id: 1001 })] });
    expect(native.schedule).toHaveBeenCalledWith({ notifications: [expect.objectContaining({ id: 1002 })] });
    native.schedule.mockClear();
    storage.set("nuj.daily_reminder", JSON.stringify({ enabled: false, time: "08:00", intervalDays: 1 }));
    await scheduleDailyReminderNotification();
    expect(native.schedule).not.toHaveBeenCalled();
  });

  it("does not reschedule after being switched off during a permission check", async () => {
    let resolvePermission: (value: { display: string }) => void;
    native.checkPermissions.mockImplementationOnce(() => new Promise((resolve) => { resolvePermission = resolve; }));
    storage.set("nuj.daily_reminder", JSON.stringify({ enabled: true, time: "08:00", intervalDays: 1 }));
    const enabling = scheduleDailyReminderNotification();
    await vi.waitFor(() => expect(native.checkPermissions).toHaveBeenCalled());
    storage.set("nuj.daily_reminder", JSON.stringify({ enabled: false, time: "08:00", intervalDays: 1 }));
    const disabling = scheduleDailyReminderNotification();
    resolvePermission!({ display: "granted" });
    await Promise.all([enabling, disabling]);
    expect(native.schedule).not.toHaveBeenCalled();
    expect(native.cancel).toHaveBeenLastCalledWith({ notifications: expect.arrayContaining([{ id: 1002 }]) });
  });
});
