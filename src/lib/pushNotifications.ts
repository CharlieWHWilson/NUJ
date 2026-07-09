import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  type PermissionStatus,
  type Token,
} from "@capacitor/push-notifications";
import { supabase } from "@/lib/supabase";

const PUSH_TOKEN_STORAGE_KEY = "nuj.push_token.current";

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

const persistPushToken = async (token: Token) => {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("Unable to resolve authenticated user for push token", userError?.message);
    return;
  }

  const previousToken = getStoredPushToken();
  if (previousToken && previousToken !== token.value) {
    await deletePushToken(user.id, previousToken);
  }

  const timestamp = new Date().toISOString();
  const { error } = await supabase.from("push_tokens").upsert(
    {
      user_id: user.id,
      token: token.value,
      platform: Capacitor.getPlatform(),
      updated_at: timestamp,
      last_seen: timestamp,
    },
    {
      onConflict: "user_id,token",
    },
  );

  if (error) {
    console.error("Failed to save push token", error.message);
    return;
  }

  setStoredPushToken(token.value);
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
