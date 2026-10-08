import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/lib/badgePlugin";
import {
  hasReminderIntervalElapsed,
  isCheckinReminderNotificationId,
  loadDailyReminderSettings,
} from "@/lib/dailyReminder";
import { derivePresenceStatus, getCurrentUserId, getLatestCheckinForUser } from "@/lib/supabaseData";

interface AttentionBadgeInputs {
  unreadCount: number;
  checkedInToday: boolean;
  reminderEnabled: boolean;
  reminderTime: string;
  now?: Date;
}

export const calculateAttentionBadgeCount = ({
  unreadCount,
  checkedInToday,
  reminderEnabled,
  reminderTime,
  now = new Date(),
}: AttentionBadgeInputs): number => {
  const reminderDue = reminderEnabled && (() => {
    const [hours, minutes] = reminderTime.split(":").map(Number);
    const reminderTimeValue = new Date(now);
    reminderTimeValue.setHours(hours, minutes, 0, 0);
    return now >= reminderTimeValue;
  })();

  return unreadCount + (checkedInToday ? 0 : reminderDue ? 1 : 0);
};

let listenersRegistered = false;

const isNativeIos = () => Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";

const toNonNegativeInt = (value: unknown) => {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.floor(value));
};

const setNativeBadgeCount = async (count: number) => {
  if (!isNativeIos()) return;

  try {
    await Badge.set({ count: toNonNegativeInt(count) });
  } catch (error) {
    console.warn("Failed to set native badge count", error);
  }
};

// Count unread NUJs directly: get_my_badge_count also includes the server-side needs_check_in
// flag, which double-counts the reminder (and can be stale) since it's added locally below.
const fetchUnreadNujCount = async (userId: string): Promise<number> => {
  const { count, error } = await supabase
    .from("nujs")
    .select("id", { count: "exact", head: true })
    .eq("recipient_user_id", userId)
    .is("acknowledged_at", null)
    .is("read_at", null);

  if (error) {
    throw error;
  }

  return toNonNegativeInt(count);
};

const computeBadgeCountFromLiveState = async (): Promise<number> => {
  const userId = await getCurrentUserId();
  if (!userId) return 0;

  const reminderSettings = loadDailyReminderSettings();
  const [latestCheckin, unreadCount] = await Promise.all([
    getLatestCheckinForUser(userId),
    fetchUnreadNujCount(userId),
  ]);

  return calculateAttentionBadgeCount({
    unreadCount,
    checkedInToday: derivePresenceStatus(latestCheckin) === "today",
    reminderEnabled: reminderSettings.enabled
      && hasReminderIntervalElapsed(reminderSettings.intervalDays, latestCheckin),
    reminderTime: reminderSettings.time,
  });
};

const hasCurrentUserCheckedInToday = async (userId: string): Promise<boolean> => {
  const latestCheckin = await getLatestCheckinForUser(userId);
  return derivePresenceStatus(latestCheckin) === "today";
};

const setNeedsCheckIn = async (needsCheckIn: boolean) => {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const { error } = await supabase
    .from("profiles")
    .update({ needs_check_in: needsCheckIn })
    .eq("id", userId);

  if (error) {
    throw error;
  }
};

const updateNeedsCheckInFromReminderState = async () => {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const reminderSettings = loadDailyReminderSettings();
  if (!reminderSettings.enabled) {
    await setNeedsCheckIn(false);
    return;
  }

  const [hours, minutes] = reminderSettings.time.split(":").map(Number);
  const now = new Date();
  const reminderTime = new Date(now);
  reminderTime.setHours(hours, minutes, 0, 0);

  const latestCheckin = await getLatestCheckinForUser(userId);
  const checkedInToday = derivePresenceStatus(latestCheckin) === "today";
  if (checkedInToday || !hasReminderIntervalElapsed(reminderSettings.intervalDays, latestCheckin)) {
    await setNeedsCheckIn(false);
    return;
  }

  const shouldNeedCheckIn = now >= reminderTime;
  await setNeedsCheckIn(shouldNeedCheckIn);
};

const handleDailyReminderNotification = async () => {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const reminderSettings = loadDailyReminderSettings();
  const checkedInToday = await hasCurrentUserCheckedInToday(userId);
  if (checkedInToday || !reminderSettings.enabled) {
    await setNeedsCheckIn(false);
    return;
  }

  await setNeedsCheckIn(true);
};

const registerNativeReminderListeners = () => {
  if (!isNativeIos() || listenersRegistered) return;

  LocalNotifications.addListener("localNotificationReceived", async (event) => {
    const notificationId = (event as { id?: number }).id;
    if (!isCheckinReminderNotificationId(notificationId)) return;

    await handleDailyReminderNotification();
    await syncAttentionBadgeCount();
  });

  LocalNotifications.addListener("localNotificationActionPerformed", async (event) => {
    const notificationId = (event as { notification?: { id?: number } }).notification?.id;
    if (!isCheckinReminderNotificationId(notificationId)) return;

    await handleDailyReminderNotification();
    await syncAttentionBadgeCount();
  });

  listenersRegistered = true;
};

export const syncAttentionBadgeCount = async (): Promise<number> => {
  try {
    const count = await computeBadgeCountFromLiveState();
    await setNativeBadgeCount(count);
    return count;
  } catch (error) {
    console.warn("Failed to sync attention badge count", error);
    return 0;
  }
};

export const clearAttentionBadgeCount = async () => {
  await setNativeBadgeCount(0);
};

export const setNeedsCheckInAndSyncBadge = async (needsCheckIn: boolean) => {
  try {
    await setNeedsCheckIn(needsCheckIn);
  } catch (error) {
    console.warn("Failed to update needs_check_in", error);
  }

  await syncAttentionBadgeCount();
};

export const initializeAttentionBadge = async () => {
  registerNativeReminderListeners();

  try {
    await updateNeedsCheckInFromReminderState();
  } catch (error) {
    console.warn("Failed to reconcile reminder check-in state", error);
  }

  await syncAttentionBadgeCount();
};
