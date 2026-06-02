import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const JOINED_MEETUPS_STORAGE_KEY = "nuj.joined_meetups";
const DEFAULT_JOINED_MEETUPS = ["m1", "m3"];

const loadJoinedMeetups = (): string[] => {
  if (typeof window === "undefined") return DEFAULT_JOINED_MEETUPS;

  try {
    const rawValue = localStorage.getItem(JOINED_MEETUPS_STORAGE_KEY);
    if (!rawValue) return DEFAULT_JOINED_MEETUPS;

    const parsedValue: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) return DEFAULT_JOINED_MEETUPS;

    return parsedValue.filter((value): value is string => typeof value === "string");
  } catch {
    return DEFAULT_JOINED_MEETUPS;
  }
};

const saveJoinedMeetups = (meetupIds: string[]) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(JOINED_MEETUPS_STORAGE_KEY, JSON.stringify(meetupIds));
};

type MeetupAttendeeRow = {
  meetup_id: string;
};

export const useJoinedMeetups = () => {
  const [joinedMeetupIds, setJoinedMeetupIds] = useState<string[]>(() => loadJoinedMeetups());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJoinedMeetups = async () => {
      try {
        setLoading(true);
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!userData.user) {
          setLoading(false);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from<MeetupAttendeeRow>("meetup_attendees")
          .select("meetup_id")
          .eq("user_id", userData.user.id);

        if (fetchError) throw fetchError;

        const meetupIds = (data || []).map((row) => row.meetup_id);
        setJoinedMeetupIds(meetupIds);
        saveJoinedMeetups(meetupIds);
        setError(null);
      } catch (err) {
        console.error("Failed to load joined meetups:", err);
        setError(err instanceof Error ? err.message : "Unable to load joined meetups");
      } finally {
        setLoading(false);
      }
    };

    fetchJoinedMeetups();
  }, []);

  const joinMeetup = async (meetupId: string) => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Not authenticated");

      const { error: insertError } = await supabase
        .from("meetup_attendees")
        .insert({
          meetup_id: meetupId,
          user_id: userData.user.id,
        });

      if (insertError) {
        if (insertError.code === "23505") {
          return;
        }
        throw insertError;
      }

      setJoinedMeetupIds((currentIds) => {
        if (currentIds.includes(meetupId)) return currentIds;
        const nextIds = [...currentIds, meetupId];
        saveJoinedMeetups(nextIds);
        return nextIds;
      });
    } catch (err) {
      console.error("Failed to join meetup:", err);
      throw err;
    }
  };

  const leaveMeetup = async (meetupId: string) => {
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;
      if (!userData.user) throw new Error("Not authenticated");

      const { error: deleteError } = await supabase
        .from("meetup_attendees")
        .delete()
        .eq("meetup_id", meetupId)
        .eq("user_id", userData.user.id);

      if (deleteError) throw deleteError;

      setJoinedMeetupIds((currentIds) => {
        const nextIds = currentIds.filter((id) => id !== meetupId);
        saveJoinedMeetups(nextIds);
        return nextIds;
      });
    } catch (err) {
      console.error("Failed to leave meetup:", err);
      throw err;
    }
  };

  const hasJoinedMeetup = (meetupId: string) => new Set(joinedMeetupIds).has(meetupId);

  return {
    joinedMeetupIds,
    hasJoinedMeetup,
    joinMeetup,
    leaveMeetup,
    loading,
    error,
  };
};
