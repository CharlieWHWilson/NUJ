import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { supabase } from "@/lib/supabase";
import { Badge } from "@/lib/badgePlugin";
import { DAILY_REMINDER_NOTIFICATION_ID, loadDailyReminderSettings } from "@/lib/dailyReminder";
import { derivePresenceStatus, getCurrentUserId, getLatestCheckinForUser } from "@/lib/supabaseData";

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

const fetchServerBadgeCount = async (): Promise<number> => {
  if (typeof supabase.rpc !== "function") {
    return 0;
  }

  const { data, error } = await supabase.rpc("get_my_badge_count");
  if (error) {
    throw error;
  }

  return toNonNegativeInt(data);
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

  const checkedInToday = await hasCurrentUserCheckedInToday(userId);
  const shouldNeedCheckIn = !checkedInToday && now >= reminderTime;
  await setNeedsCheckIn(shouldNeedCheckIn);
};

const handleDailyReminderNotification = async () => {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const checkedInToday = await hasCurrentUserCheckedInToday(userId);
  if (checkedInToday) {
    await setNeedsCheckIn(false);
    return;
  }

  await setNeedsCheckIn(true);
};

const registerNativeReminderListeners = () => {
  if (!isNativeIos() || listenersRegistered) return;

  LocalNotifications.addListener("localNotificationReceived", async (event) => {
    const notificationId = (event as { id?: number }).id;
    if (notificationId !== DAILY_REMINDER_NOTIFICATION_ID) return;

    await handleDailyReminderNotification();
    await syncAttentionBadgeCount();
  });

  LocalNotifications.addListener("localNotificationActionPerformed", async (event) => {
    const notificationId = (event as { notification?: { id?: number } }).notification?.id;
    if (notificationId !== DAILY_REMINDER_NOTIFICATION_ID) return;

    await handleDailyReminderNotification();
    await syncAttentionBadgeCount();
  });

  listenersRegistered = true;
};

export const syncAttentionBadgeCount = async (): Promise<number> => {
  try {
    const count = await fetchServerBadgeCount();
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
