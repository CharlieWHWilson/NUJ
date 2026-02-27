import { useMemo, useState } from "react";

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

export const useJoinedMeetups = () => {
  const [joinedMeetupIds, setJoinedMeetupIds] = useState<string[]>(() => loadJoinedMeetups());

  const joinedMeetupIdsSet = useMemo(() => new Set(joinedMeetupIds), [joinedMeetupIds]);

  const joinMeetup = (meetupId: string) => {
    setJoinedMeetupIds((currentIds) => {
      if (currentIds.includes(meetupId)) return currentIds;
      const nextIds = [...currentIds, meetupId];
      saveJoinedMeetups(nextIds);
      return nextIds;
    });
  };

  const leaveMeetup = (meetupId: string) => {
    setJoinedMeetupIds((currentIds) => {
      if (!currentIds.includes(meetupId)) return currentIds;
      const nextIds = currentIds.filter((id) => id !== meetupId);
      saveJoinedMeetups(nextIds);
      return nextIds;
    });
  };

  const hasJoinedMeetup = (meetupId: string) => joinedMeetupIdsSet.has(meetupId);

  return {
    joinedMeetupIds,
    hasJoinedMeetup,
    joinMeetup,
    leaveMeetup,
  };
};
