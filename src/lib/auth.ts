import { supabase } from "./supabase";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export const registerUser = async (input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}) => {
  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
    });

    if (authError) {
      return { ok: false as const, message: authError.message };
    }

    if (!authData.user) {
      return { ok: false as const, message: "Registration failed: No user returned" };
    }

    // Create profile
    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      name: input.name,
      email: input.email,
      phone: input.phone,
    });

    if (profileError) {
      return { ok: false as const, message: profileError.message };
    }

    return { ok: true as const };
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

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();

    if (error || !profile) return null;

    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      phone: profile.phone,
    };
  } catch {
    return null;
  }
};

export const isAuthenticated = async (): Promise<boolean> => {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
};

export const logoutUser = async () => {
  await supabase.auth.signOut();
};
