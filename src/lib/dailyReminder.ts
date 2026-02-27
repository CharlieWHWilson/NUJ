export interface DailyReminderSettings {
  enabled: boolean;
  time: string;
}

const REMINDER_STORAGE_KEY = "nuj.daily_reminder";
const DEFAULT_SETTINGS: DailyReminderSettings = {
  enabled: false,
  time: "09:00",
};

let scheduledReminderTimeout: number | null = null;

const isValidTime = (value: string): boolean => {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value);
};

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
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveDailyReminderSettings = (settings: DailyReminderSettings) => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(settings));
};

const getNextReminderDate = (time: string): Date => {
  const [hours, minutes] = time.split(":").map((value) => Number(value));
  const now = new Date();
  const nextReminder = new Date(now);

  nextReminder.setHours(hours, minutes, 0, 0);

  if (nextReminder <= now) {
    nextReminder.setDate(nextReminder.getDate() + 1);
  }

  return nextReminder;
};

export const scheduleDailyReminderNotification = () => {
  if (typeof window === "undefined") return;

  if (scheduledReminderTimeout !== null) {
    window.clearTimeout(scheduledReminderTimeout);
    scheduledReminderTimeout = null;
  }

  const settings = loadDailyReminderSettings();
  if (!settings.enabled) return;

  const nextReminder = getNextReminderDate(settings.time);
  const delay = nextReminder.getTime() - Date.now();

  scheduledReminderTimeout = window.setTimeout(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification("NUJ check-in reminder", {
        body: "Time to check in and let your mates know you're around.",
      });
    }

    scheduleDailyReminderNotification();
  }, delay);
};
