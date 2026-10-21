import { supabase } from "./supabase";

export const establishRecoverySession = async (url: string): Promise<void> => {
  const parsed = new URL(url);
  const fragment = new URLSearchParams(parsed.hash.slice(1));
  const accessToken = fragment.get("access_token");
  const refreshToken = fragment.get("refresh_token");
  const code = parsed.searchParams.get("code");
  try {
    if (fragment.has("error") || parsed.searchParams.has("error")) throw new Error("Invalid recovery link");
    if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) throw error;
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else if (accessToken || refreshToken) {
      throw new Error("Incomplete recovery link");
    }
  } catch {
    throw new Error("This reset link is missing, invalid, or expired. Request a new password reset email.");
  } finally {
    if (typeof window !== "undefined") {
      for (const parameter of ["code", "error", "error_description", "type"]) parsed.searchParams.delete(parameter);
      const query = parsed.searchParams.toString();
      window.history.replaceState(window.history.state, "", `${parsed.pathname}${query ? `?${query}` : ""}`);
    }
  }
};