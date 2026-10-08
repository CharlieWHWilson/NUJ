import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

export interface DailyReminderSettings {
  enabled: boolean;
  time: string;
  intervalDays: number;
}

const REMINDER_STORAGE_KEY = "nuj.daily_reminder";
export const LAST_CHECKIN_STORAGE_KEY = "nuj.last_checkin_at";
export const REMINDER_INTERVAL_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;
const DEFAULT_SETTINGS: DailyReminderSettings = {
  enabled: false,
  time: "08:00",
  intervalDays: 1,
};

let scheduledReminderTimeout: number | null = null;
export const DAILY_REMINDER_NOTIFICATION_ID = 1001;
export const INACTIVITY_REMINDER_NOTIFICATION_ID = 1002;
const INACTIVITY_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;
// Multi-day reminders can't repeat natively, so a batch of one-off notifications is queued and topped up on app open/check-in.
const INTERVAL_REMINDER_BASE_ID = 1100;
const INTERVAL_REMINDER_BATCH_SIZE = 10;
const INTERVAL_REMINDER_IDS = Array.from({ length: INTERVAL_REMINDER_BATCH_SIZE }, (_, index) => INTERVAL_REMINDER_BASE_ID + index + 1);
const DAY_MS = 24 * 60 * 60 * 1000;

export const isCheckinReminderNotificationId = (id: unknown) =>
  id === DAILY_REMINDER_NOTIFICATION_ID || INTERVAL_REMINDER_IDS.includes(id as number);

const isValidTime = (value: string): boolean => {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
};

const isValidInterval = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 7;

export const loadDailyReminderSettings = (): DailyReminderSettings => {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;

  try {
    const rawValue = window.localStorage.getItem(REMINDER_STORAGE_KEY);
    if (!rawValue) return DEFAULT_SETTINGS;

    const parsedValue: unknown = JSON.parse(rawValue);
    if (!parsedValue || typeof parsedValue !== "object") return DEFAULT_SETTINGS;

    const maybeSettings = parsedValue as Partial<DailyReminderSettings>;
    const time = typeof maybeSettings.time === "string" && isValidTime(maybeSettings.time)
      ? maybeSettings.time
      : DEFAULT_SETTINGS.time;

    return {
      enabled: Boolean(maybeSettings.enabled),
      time,
      intervalDays: isValidInterval(maybeSettings.intervalDays) ? maybeSettings.intervalDays : DEFAULT_SETTINGS.intervalDays,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveDailyReminderSettings = (settings: DailyReminderSettings) => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(settings));
};

const loadLastCheckin = (): Date | null => {
  if (typeof window === "undefined") return null;

  const rawValue = window.localStorage.getItem(LAST_CHECKIN_STORAGE_KEY);
  if (!rawValue) return null;

  const parsed = new Date(rawValue);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const startOfDay = (date: Date) => {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
};

export const hasReminderIntervalElapsed = (
  intervalDays: number,
  lastCheckinAt: string | Date | null,
  now: Date = new Date(),
) => {
  if (intervalDays <= 1 || !lastCheckinAt) return true;

  const lastCheckin = new Date(lastCheckinAt);
  if (Number.isNaN(lastCheckin.getTime())) return true;

  const daysSince = Math.round((startOfDay(now).getTime() - startOfDay(lastCheckin).getTime()) / DAY_MS);
  return daysSince >= intervalDays;
};

// Reminders land at the chosen time every `intervalDays`, counted from the last check-in when known.
export const getUpcomingReminderDates = (
  time: string,
  intervalDays: number,
  lastCheckinAt: Date | null,
  now: Date = new Date(),
  count = 1,
): Date[] => {
  const [hours, minutes] = time.split(":").map((value) => Number(value));
  const step = Math.max(1, intervalDays);
  const next = new Date(lastCheckinAt ?? now);

  next.setHours(hours, minutes, 0, 0);
  if (lastCheckinAt) {
    next.setDate(next.getDate() + step);
  }
  while (next <= now) {
    next.setDate(next.getDate() + step);
  }

  return Array.from({ length: count }, (_, index) => {
    const date = new Date(next);
    date.setDate(date.getDate() + index * step);
    return date;
  });
};

const isNativePlatform = () => Capacitor.isNativePlatform();

const ensureNativeReminderPermission = async (): Promise<boolean> => {
  const currentPermission = await LocalNotifications.checkPermissions();
  if (currentPermission.display === "granted") {
    return true;
  }

  const requestedPermission = await LocalNotifications.requestPermissions();
  return requestedPermission.display === "granted";
};

const cancelNativeReminder = async () => {
  await LocalNotifications.cancel({
    notifications: [DAILY_REMINDER_NOTIFICATION_ID, ...INTERVAL_REMINDER_IDS].map((id) => ({ id })),
  });
};

const REMINDER_TITLE = "NUJ check-in reminder";
const REMINDER_BODY = "Time for a quick check-in so your mates know you're there.";

const scheduleNativeReminder = async (settings: DailyReminderSettings) => {
  if (settings.intervalDays > 1) {
    const dates = getUpcomingReminderDates(
      settings.time,
      settings.intervalDays,
      loadLastCheckin(),
      new Date(),
      INTERVAL_REMINDER_BATCH_SIZE,
    );

    await LocalNotifications.schedule({
      notifications: dates.map((at, index) => ({
        id: INTERVAL_REMINDER_IDS[index],
        title: REMINDER_TITLE,
        body: REMINDER_BODY,
        schedule: { at, allowWhileIdle: true },
      })),
    });
    return;
  }

  const [hours, minutes] = settings.time.split(":").map((value) => Number(value));

  await LocalNotifications.schedule({
    notifications: [
      {
        id: DAILY_REMINDER_NOTIFICATION_ID,
        title: REMINDER_TITLE,
        body: REMINDER_BODY,
        schedule: {
          on: {
            hour: hours,
            minute: minutes,
          },
          repeats: true,
          allowWhileIdle: true,
        },
      },
    ],
  });
};

export const requestDailyReminderPermission = async (): Promise<boolean> => {
  if (typeof window === "undefined") return false;

  if (isNativePlatform()) {
    return ensureNativeReminderPermission();
  }

  if (!("Notification" in window)) {
    return false;
  }

  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();

  return permission === "granted";
};

// First reminder-time slot strictly more than a week after the last check-in.
export const getInactivityReminderDate = (lastCheckinAt: Date, time: string): Date => {
  const [hours, minutes] = time.split(":").map((value) => Number(value));
  const threshold = new Date(lastCheckinAt.getTime() + INACTIVITY_THRESHOLD_MS);
  const fireAt = new Date(threshold);

  fireAt.setHours(hours, minutes, 0, 0);

  if (fireAt <= threshold) {
    fireAt.setDate(fireAt.getDate() + 1);
  }

  return fireAt;
};

export const scheduleInactivityReminder = async (lastCheckinAt: string | Date | null) => {
  if (typeof window === "undefined" || !isNativePlatform()) return;

  try {
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display !== "granted") return;

    await LocalNotifications.cancel({
      notifications: [{ id: INACTIVITY_REMINDER_NOTIFICATION_ID }],
    });

    if (!lastCheckinAt) return;

    const lastCheckin = new Date(lastCheckinAt);
    if (Number.isNaN(lastCheckin.getTime())) return;

    const fireAt = getInactivityReminderDate(lastCheckin, loadDailyReminderSettings().time);
    if (fireAt.getTime() <= Date.now()) return;

    await LocalNotifications.schedule({
      notifications: [
        {
          id: INACTIVITY_REMINDER_NOTIFICATION_ID,
          title: "",
          body: "You haven't checked in for over a week. Tap to let your mates know you're there.",
          schedule: { at: fireAt, allowWhileIdle: true },
        },
      ],
    });
  } catch (error) {
    console.warn("Failed to schedule inactivity reminder", error);
  }
};

export const scheduleDailyReminderNotification = async () => {
  if (typeof window === "undefined") return;

  if (scheduledReminderTimeout !== null) {
    window.clearTimeout(scheduledReminderTimeout);
    scheduledReminderTimeout = null;
  }

  const settings = loadDailyReminderSettings();
  if (!settings.enabled) {
    if (isNativePlatform()) {
      await cancelNativeReminder();
    }
    return;
  }

  if (isNativePlatform()) {
    const hasPermission = await ensureNativeReminderPermission();
    if (!hasPermission) {
      return;
    }

    await cancelNativeReminder();
    await scheduleNativeReminder(settings);
    return;
  }

  const [nextReminder] = getUpcomingReminderDates(
    settings.time,
    settings.intervalDays,
    settings.intervalDays > 1 ? loadLastCheckin() : null,
  );
  const delay = nextReminder.getTime() - Date.now();

  scheduledReminderTimeout = window.setTimeout(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification(REMINDER_TITLE, {
        body: REMINDER_BODY,
      });
    }

    scheduleDailyReminderNotification();
  }, delay);
};

export const recordLastCheckin = (lastCheckinAt: string | Date | null) => {
  if (typeof window === "undefined") return;

  const lastCheckin = lastCheckinAt ? new Date(lastCheckinAt) : null;
  try {
    if (lastCheckin && !Number.isNaN(lastCheckin.getTime())) {
      window.localStorage.setItem(LAST_CHECKIN_STORAGE_KEY, lastCheckin.toISOString());
    } else {
      window.localStorage.removeItem(LAST_CHECKIN_STORAGE_KEY);
    }
  } catch (error) {
    console.warn("Failed to store last check-in", error);
  }

  void scheduleDailyReminderNotification();
  void scheduleInactivityReminder(lastCheckinAt);
};
