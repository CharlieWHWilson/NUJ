import { useEffect, useState } from "react";
import {
  derivePresenceStatus,
  getCurrentUserId,
  getLatestCheckinForUser,
  upsertCurrentUserCheckin,
} from "@/lib/supabaseData";
import { supabase } from "@/lib/supabase";

const toErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string" && maybeMessage.length > 0) {
      return maybeMessage;
    }
  }
  return fallback;
};

export const useCheckin = (currentUserId?: string) => {
  const [checkedIn, setCheckedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authSyncNonce, setAuthSyncNonce] = useState(0);

  useEffect(() => {
    const authSubscription = supabase.auth.onAuthStateChange(() => {
      setAuthSyncNonce((prev) => prev + 1);
    });

    return () => {
      authSubscription.data?.subscription?.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let active = true;

    const syncCheckinState = async () => {
      if (active) {
        setLoading(true);
        setError(null);
      }

      const resolvedUserId = currentUserId ?? await getCurrentUserId();

      if (!resolvedUserId) {
        if (active) {
          setCheckedIn(false);
          setLoading(false);
        }
        return;
      }

      try {
        const latestCheckin = await getLatestCheckinForUser(resolvedUserId);
        if (active) {
          setCheckedIn(derivePresenceStatus(latestCheckin) === "today");
          setLoading(false);
        }
      } catch (err) {
        if (active) {
          setCheckedIn(false);
          setError(toErrorMessage(err, "Failed to load check-in status"));
          setLoading(false);
        }
      }
    };

    void syncCheckinState();

    return () => {
      active = false;
    };
  }, [currentUserId, authSyncNonce]);

  const doCheckin = async () => {
    const resolvedUserId = currentUserId ?? await getCurrentUserId();

    if (!resolvedUserId) {
      setError("You must be logged in to check in");
      return false;
    }

    try {
      setError(null);
      await upsertCurrentUserCheckin();
      setCheckedIn(true);
      window.dispatchEvent(new Event("nuj:checkin-updated"));
      return true;
    } catch (err) {
      setCheckedIn(false);
      setError(toErrorMessage(err, "Check-in failed"));
      return false;
    }
  };

  return { checkedIn, doCheckin, loading, error };
};
