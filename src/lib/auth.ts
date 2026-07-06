import { supabase } from "./supabase";

export interface AuthUser {
  id: string;
  username: string;
  email?: string;
  userCode?: string;
}

export const registerUser = async (input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}) => {
  try {
    // Create auth user and store basic metadata
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          name: input.name,
          phone: input.phone,
        },
      },
    });

    if (authError) {
      return { ok: false as const, message: authError.message };
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

    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      username: input.name,
    });

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

export const getCurrentUser = async (): Promise<AuthUser | null> => {
  try {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return null;

    const authUser = data.user;
    const fallbackUsername = authUser.user_metadata?.name ?? authUser.email ?? "Unknown user";

    const fetchProfile = async (selection: string) => (
      supabase
        .from("profiles")
        .select(selection)
        .eq("id", authUser.id)
        .maybeSingle()
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

    if (!profile) {
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        await supabase.from("profiles").insert({
          id: authUser.id,
          username: fallbackUsername,
        });
      }
    }

    return {
      id: authUser.id,
      username: profile?.username ?? fallbackUsername,
      email: authUser.email ?? undefined,
      userCode: profile?.user_code ?? authUser.id,
    };
  } catch {
    return null;
  }
};

export const isAuthenticated = async (): Promise<boolean> => {
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error) return false;
    return !!data.user;
  } catch {
    return false;
  }
};

export const logoutUser = async () => {
  await supabase.auth.signOut();
};
