import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  type PermissionStatus,
  type Token,
} from "@capacitor/push-notifications";
import { supabase } from "@/lib/supabase";

const PUSH_TOKEN_STORAGE_KEY = "nuj.push_token.current";
const PENDING_PUSH_TOKEN_STORAGE_KEY = "nuj.push_token.pending";
const PUSH_OPEN_DASHBOARD_KEY = "nuj.push.open_dashboard";
const PUSH_OPEN_DASHBOARD_EVENT = "nuj:open-dashboard";

let listenersRegistered = false;
let registrationPromise: Promise<void> | null = null;

const isNativePushEnvironment = () => Capacitor.isNativePlatform();

const getStoredPushToken = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
};

const setStoredPushToken = (token: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
};

const clearStoredPushToken = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
};

const getPendingPushToken = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(PENDING_PUSH_TOKEN_STORAGE_KEY);
};

const setPendingPushToken = (token: string) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PENDING_PUSH_TOKEN_STORAGE_KEY, token);
};

const clearPendingPushToken = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PENDING_PUSH_TOKEN_STORAGE_KEY);
};

const requestDashboardOpenFromPush = () => {
  if (typeof window === "undefined") return;

  window.sessionStorage.setItem(PUSH_OPEN_DASHBOARD_KEY, "1");
  window.dispatchEvent(new CustomEvent(PUSH_OPEN_DASHBOARD_EVENT));
};

const deletePushToken = async (userId: string, token: string) => {
  const { error } = await supabase
    .from("push_tokens")
    .delete()
    .eq("user_id", userId)
    .eq("token", token);

  if (error) {
    console.error("Failed to delete push token", error.message);
  }
};

const persistPushTokenValueForCurrentUser = async (tokenValue: string) => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false as const, reason: "no_user" as const, message: userError?.message };
  }

  const previousToken = getStoredPushToken();
  if (previousToken && previousToken !== tokenValue) {
    await deletePushToken(user.id, previousToken);
  }

  const timestamp = new Date().toISOString();
  const { error } = await supabase.from("push_tokens").upsert(
    {
      user_id: user.id,
      token: tokenValue,
      platform: Capacitor.getPlatform(),
      updated_at: timestamp,
      last_seen: timestamp,
    },
    {
      onConflict: "user_id,token",
    },
  );

  if (error) {
    return { ok: false as const, reason: "db_error" as const, message: error.message };
  }

  setStoredPushToken(tokenValue);
  clearPendingPushToken();

  return { ok: true as const };
};

const persistPushToken = async (token: Token) => {
  const result = await persistPushTokenValueForCurrentUser(token.value);

  if (!result.ok) {
    // Registration can complete before auth session hydration on app launch.
    // Keep the token and retry once authenticated.
    setPendingPushToken(token.value);
    console.warn("Push token deferred for later sync", result.message ?? result.reason);
  }
};

export const syncPendingPushToken = async () => {
  if (!isNativePushEnvironment()) return;

  const pendingToken = getPendingPushToken();
  if (!pendingToken) return;

  const result = await persistPushTokenValueForCurrentUser(pendingToken);
  if (!result.ok) {
    console.warn("Pending push token sync failed", result.message ?? result.reason);
  }
};

const ensurePushListeners = () => {
  if (listenersRegistered) return;

  PushNotifications.addListener("registration", async (token) => {
    console.log("APNs device token received", token.value);
    await persistPushToken(token);
  });

  PushNotifications.addListener("registrationError", (error) => {
    console.error("Push registration failed", error);
  });

  PushNotifications.addListener("pushNotificationActionPerformed", () => {
    requestDashboardOpenFromPush();
  });

  listenersRegistered = true;
};

const ensurePushPermission = async (): Promise<PermissionStatus> => {
  const currentPermissions = await PushNotifications.checkPermissions();
  if (currentPermissions.receive === "prompt") {
    return PushNotifications.requestPermissions();
  }

  return currentPermissions;
};

export const registerForPushNotifications = async () => {
  if (!isNativePushEnvironment()) return;

  ensurePushListeners();

  if (registrationPromise) {
    await registrationPromise;
    return;
  }

  registrationPromise = (async () => {
    const permission = await ensurePushPermission();
    if (permission.receive !== "granted") {
      console.log("Push notification permission not granted");
      return;
    }

    await PushNotifications.register();
  })();

  try {
    await registrationPromise;
    await syncPendingPushToken();
  } finally {
    registrationPromise = null;
  }
};

export const removeCurrentPushToken = async () => {
  if (!isNativePushEnvironment()) return;

  const token = getStoredPushToken();
  if (!token) return;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    await deletePushToken(user.id, token);
  }

  clearStoredPushToken();
};
