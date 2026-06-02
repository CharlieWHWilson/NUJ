import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { NujReceived } from "@/data/mockData";
import { NujSent } from "@/data/nujsSent";

export const useNujsSupabase = () => {
  const [nujsReceived, setNujsReceived] = useState<NujReceived[]>([]);
  const [nujsSent, setNujsSent] = useState<NujSent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchNujs = async () => {
      try {
        setLoading(true);
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          setNujsReceived([]);
          setNujsSent([]);
          setLoading(false);
          return;
        }

        // Fetch received NUJs with mate details
        const { data: receivedData, error: receivedError } = await supabase
          .from("nujs_received")
          .select(
            `id,
             received_at,
             mates(id, name, initials)`
          )
          .eq("user_id", userData.user.id)
          .order("received_at", { ascending: false });

        if (receivedError) throw receivedError;

        const formattedReceived: NujReceived[] = (receivedData || []).map((nuj: any) => ({
          id: nuj.id,
          fromMateId: nuj.mates.id,
          fromMateName: nuj.mates.name,
          fromMateInitials: nuj.mates.initials,
          sentAt: nuj.received_at,
        }));

        // Fetch sent NUJs with mate details
        const { data: sentData, error: sentError } = await supabase
          .from("nujs_sent")
          .select(
            `id,
             sent_at,
             mates(id, name, initials)`
          )
          .eq("user_id", userData.user.id)
          .order("sent_at", { ascending: false });

        if (sentError) throw sentError;

        const formattedSent: NujSent[] = (sentData || []).map((nuj: any) => ({
          id: nuj.id,
          toMateId: nuj.mates.id,
          toMateName: nuj.mates.name,
          toMateInitials: nuj.mates.initials,
          sentAt: nuj.sent_at,
        }));

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

    fetchNujs();
  }, []);

  const sendNuj = async (toMateId: string, toMateName: string, toMateInitials: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not authenticated");

      const { data, error: insertError } = await supabase
        .from("nujs_sent")
        .insert({
          user_id: userData.user.id,
          to_mate_id: toMateId,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const newNuj: NujSent = {
        id: data.id,
        toMateId,
        toMateName,
        toMateInitials,
        sentAt: data.sent_at,
      };

      setNujsSent((prev) => [newNuj, ...prev]);
      return newNuj;
    } catch (err) {
      console.error("Error sending NUJ:", err);
      throw err;
    }
  };

  const removeReceivedNuj = async (nujId: string) => {
    try {
      const { error: deleteError } = await supabase
        .from("nujs_received")
        .delete()
        .eq("id", nujId);

      if (deleteError) throw deleteError;

      setNujsReceived((prev) => prev.filter((n) => n.id !== nujId));
    } catch (err) {
      console.error("Error removing received NUJ:", err);
      throw err;
    }
  };

  return {
    nujsReceived,
    nujsSent,
    loading,
    error,
    sendNuj,
    removeReceivedNuj,
  };
};
