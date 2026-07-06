import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { NujReceived } from "@/data/mockData";
import { NujSent } from "@/data/nujsSent";

export const ACTIVE_NUJ_EXISTS_ERROR = "An active NUJ is already waiting for acknowledgement.";

type NujRow = {
  id: string;
  sender_user_id: string;
  recipient_user_id: string;
  created_at: string;
  acknowledged_at: string | null;
};

type MateLookupRow = {
  id: string;
  mate_user_id: string | null;
  name: string;
  initials: string;
};

type ProfileLookupRow = {
  id: string;
  username: string;
};

const toInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .join("")
    .toUpperCase();

export const useNujsSupabase = () => {
  const [nujsReceived, setNujsReceived] = useState<NujReceived[]>([]);
  const [nujsSent, setNujsSent] = useState<NujSent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setLoading(true);
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setNujsReceived([]);
        setNujsSent([]);
        setLoading(false);
        return;
      }

      const currentUserId = userData.user.id;

      const { data: matesData, error: matesError } = await supabase
        .from("mates")
        .select("id, mate_user_id, name, initials")
        .eq("user_id", currentUserId);

      if (matesError) throw matesError;

      const mates = (matesData || []) as MateLookupRow[];
      const matesByUserId = new Map<string, MateLookupRow>();
      for (const mate of mates) {
        if (mate.mate_user_id) {
          matesByUserId.set(mate.mate_user_id, mate);
        }
      }

      const { data: receivedData, error: receivedError } = await supabase
        .from("nujs")
        .select("id, sender_user_id, recipient_user_id, created_at, acknowledged_at")
        .eq("recipient_user_id", currentUserId)
        .order("created_at", { ascending: false });

      if (receivedError) throw receivedError;

      const { data: sentData, error: sentError } = await supabase
        .from("nujs")
        .select("id, sender_user_id, recipient_user_id, created_at, acknowledged_at")
        .eq("sender_user_id", currentUserId)
        .order("created_at", { ascending: false });

      if (sentError) throw sentError;

      const receivedRows = (receivedData || []) as NujRow[];
      const sentRows = (sentData || []) as NujRow[];

      const profileUserIds = Array.from(
        new Set(
          [...receivedRows.map((row) => row.sender_user_id), ...sentRows.map((row) => row.recipient_user_id)]
            .filter((userId) => !matesByUserId.has(userId))
        )
      );

      const profilesById = new Map<string, ProfileLookupRow>();
      if (profileUserIds.length > 0) {
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, username")
          .in("id", profileUserIds);

        if (profilesError) throw profilesError;

        for (const profile of (profilesData || []) as ProfileLookupRow[]) {
          profilesById.set(profile.id, profile);
        }
      }

      const formattedReceived: NujReceived[] = receivedRows
        .filter((row) => !row.acknowledged_at)
        .map((row) => {
        const mate = matesByUserId.get(row.sender_user_id);
        const profile = profilesById.get(row.sender_user_id);
        const resolvedName = mate?.name ?? profile?.username ?? "Unknown mate";
        const resolvedInitials = mate?.initials ?? toInitials(resolvedName);

        return {
          id: row.id,
          fromMateId: mate?.id ?? row.sender_user_id,
          fromMateName: resolvedName,
          fromMateInitials: resolvedInitials,
          sentAt: row.created_at,
        };
      });

      const formattedSent: NujSent[] = sentRows
        .filter((row) => !row.acknowledged_at)
        .map((row) => {
        const mate = matesByUserId.get(row.recipient_user_id);
        const profile = profilesById.get(row.recipient_user_id);
        const resolvedName = mate?.name ?? profile?.username ?? "Unknown mate";
        const resolvedInitials = mate?.initials ?? toInitials(resolvedName);

        return {
          id: row.id,
          toMateId: mate?.id ?? row.recipient_user_id,
          toMateName: resolvedName,
          toMateInitials: resolvedInitials,
          sentAt: row.created_at,
        };
      });

      setNujsReceived(formattedReceived);
      setNujsSent(formattedSent);
      setError(null);
    } catch (err) {
      console.error("Error fetching NUJs:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch NUJs");
      setNujsReceived([]);
      setNujsSent([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const sendNuj = async (recipientUserId: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { data: existingNujs, error: existingNujsError } = await supabase
        .from("nujs")
        .select("id, acknowledged_at")
        .eq("sender_user_id", userData.user.id)
        .eq("recipient_user_id", recipientUserId);

      if (existingNujsError) throw existingNujsError;

      const hasPendingNuj = ((existingNujs as Pick<NujRow, "id" | "acknowledged_at">[] | null) || [])
        .some((row) => !row.acknowledged_at);

      if (hasPendingNuj) {
        throw new Error(ACTIVE_NUJ_EXISTS_ERROR);
      }

      const { data, error: insertError } = await supabase
        .from("nujs")
        .insert({
          sender_user_id: userData.user.id,
          recipient_user_id: recipientUserId,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      await refresh();
      return data;
    } catch (err) {
      console.error("Error sending NUJ:", err);
      if (typeof err === "object" && err !== null && "code" in err && err.code === "23505") {
        throw new Error(ACTIVE_NUJ_EXISTS_ERROR);
      }
      throw err;
    }
  };

  const acknowledgeReceivedNuj = async (nujId: string) => {
    try {
      const { error: updateError } = await supabase
        .from("nujs")
        .update({ acknowledged_at: new Date().toISOString() })
        .eq("id", nujId);

      if (updateError) throw updateError;

      setNujsReceived((prev) => prev.filter((n) => n.id !== nujId));
    } catch (err) {
      console.error("Error acknowledging received NUJ:", err);
      throw err;
    }
  };

  const cancelSentNuj = async (nujId: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { error: deleteError } = await supabase
        .from("nujs")
        .delete()
        .eq("id", nujId)
        .eq("sender_user_id", userData.user.id)
        .is("acknowledged_at", null);

      if (deleteError) throw deleteError;

      setNujsSent((prev) => prev.filter((n) => n.id !== nujId));
    } catch (err) {
      console.error("Error cancelling sent NUJ:", err);
      throw err;
    }
  };

  return {
    nujsReceived,
    nujsSent,
    loading,
    error,
    sendNuj,
    acknowledgeReceivedNuj,
    cancelSentNuj,
    refresh,
  };
};
