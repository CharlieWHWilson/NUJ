import { supabase } from "./supabase";
import { removeCurrentPushToken } from "./pushNotifications";
import { Capacitor } from "@capacitor/core";

export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  userCode?: string;
}

type AuthUserRecord = {
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
};

const mapSignupErrorMessage = (message: string): string => {
  const normalized = message.toLowerCase();
  if (normalized.includes("database error saving new user")) {
    return "Signup failed because your Supabase profiles trigger/schema is out of date. Run migrations 026_harden_profile_signup_trigger.sql and 027_remove_phone_storage.sql, then try again.";
  }

  return message;
};

const normalizeDisplayName = (value: string) => value.trim().replace(/\s+/g, " ");

const buildEmailRedirectUrl = (path: string): string | undefined => {
  if (typeof window === "undefined") return undefined;

  const base = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return Capacitor.isNativePlatform()
    ? `https://nuj.social${normalizedPath}`
    : `${window.location.origin}${base}${normalizedPath}`;
};

export const requestPasswordReset = async (value: string): Promise<void> => {
  const email = value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: buildEmailRedirectUrl("/account/update-password") });
  if (error) throw new Error("Couldn't send a reset email. Please try again.");
};

export const getRegistrationNameError = (value: string): string | null => {
  const normalized = normalizeDisplayName(value);
  if (!normalized) {
    return "First name is required.";
  }

  return null;
};

export const isVerifiedAuthUser = (user: AuthUserRecord | null | undefined): boolean => {
  if (!user) return false;
  return Boolean(user.email_confirmed_at ?? user.confirmed_at);
};

export const registerUser = async (input: {
  name: string;
  email: string;
  password: string;
}) => {
  try {
    const normalizedName = normalizeDisplayName(input.name);
    const nameError = getRegistrationNameError(normalizedName);
    if (nameError) {
      return { ok: false as const, message: nameError };
    }

    // Create auth user and store basic metadata
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        emailRedirectTo: buildEmailRedirectUrl("/check-in"),
        data: {
          name: normalizedName,
          full_name: normalizedName,
          username: normalizedName,
          display_name: normalizedName,
          phone: "",
        },
      },
    });

    if (authError) {
      return { ok: false as const, message: mapSignupErrorMessage(authError.message) };
    }

    if (!authData.user) {
      return { ok: false as const, message: "Registration failed: No user returned" };
    }

    if (!authData.session) {
      return {
        ok: true as const,
        requiresEmailConfirmation: true,
      };
    }

    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: authData.user.id,
        username: normalizedName,
      }, { onConflict: "id" });

    if (profileError) {
      return { ok: false as const, message: profileError.message };
    }

    return {
      ok: true as const,
      requiresEmailConfirmation: false,
    };
  } catch (error) {
    return { ok: false as const, message: "Registration failed" };
  }
};

export const loginUser = async (input: {
  email: string;
  password: string;
}) => {
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error) {
      return { ok: false as const, message: error.message };
    }

    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, message: "Login failed" };
  }
};

export const updateCurrentUsername = async (value: string): Promise<string> => {
  const username = normalizeDisplayName(value);
  if (!username) throw new Error("Enter a username.");
  if (username.length > 80) throw new Error("Keep your username to 80 characters or fewer.");

  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || !data.user || !isVerifiedAuthUser(data.user)) {
    throw new Error("Please sign in again to change your username.");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .update({ username })
    .eq("id", data.user.id)
    .select("username")
    .single();

  if (error) {
    throw new Error(error.code === "23505"
      ? "That username is already in use. Try another."
      : "Couldn't save your username. Please try again.");
  }
  if (!profile?.username) throw new Error("Couldn't save your username. Please try again.");
  return profile.username;
};

export const getCurrentUser = async (): Promise<AuthUser | null> => {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;
    if (!isVerifiedAuthUser(data.user)) return null;

    const authUser = data.user;
    const fallbackUsername = authUser.user_metadata?.full_name
      ?? authUser.user_metadata?.username
      ?? authUser.user_metadata?.name
      ?? authUser.email
      ?? "Unknown user";

    const fetchProfile = async (selection: string) => (
      supabase
        .from("profiles")
        .select(selection)
        .eq("id", authUser.id)
        .maybeSingle<{ username: string | null; user_code?: string | null }>()
    );

    let { data: profile, error: profileError } = await fetchProfile("username, user_code");

    if (profileError && profileError.message.toLowerCase().includes("user_code")) {
      const legacy = await fetchProfile("username");
      profile = legacy.data;
      profileError = legacy.error;
    }

    if (profileError) {
      return null;
    }

    if (!profile?.username?.trim()) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        await supabase.from("profiles").upsert({
          id: authUser.id,
          username: fallbackUsername,
        }, { onConflict: "id" });
      }
    }

    let resolvedUserCode = profile?.user_code?.trim() || undefined;
    if (!resolvedUserCode) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        await supabase.from("profiles").upsert({
          id: authUser.id,
          username: profile?.username?.trim() || fallbackUsername,
        }, { onConflict: "id" });

        const refreshedProfile = await fetchProfile("username, user_code");
        if (!refreshedProfile.error) {
          profile = refreshedProfile.data;
          resolvedUserCode = refreshedProfile.data?.user_code?.trim() || undefined;
        }
      }
    }

    return {
      id: authUser.id,
      username: profile?.username?.trim() || fallbackUsername,
      email: authUser.email ?? undefined,
      userCode: resolvedUserCode,
    };
  } catch {
    return null;
  }
};

export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) return false;
    return isVerifiedAuthUser(data.user);
  } catch {
    return false;
  }
};

export const logoutUser = async () => {
  await removeCurrentPushToken();
  await supabase.auth.signOut();
};
