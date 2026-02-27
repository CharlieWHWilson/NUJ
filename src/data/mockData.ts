export type PresenceStatus = "today" | "yesterday" | "few-days";

export interface Mate {
  id: string;
  name: string;
  initials: string;
  lastCheckin: PresenceStatus;
  group?: string;
}

export interface Group {
  id: string;
  name: string;
  mates: string[]; // mate ids
}

export interface MeetUp {
  id: string;
  title: string;
  description: string;
  location: string;
  activityType: string;
  participantsRequired: number;
  participatingMates: string[];
  rewardDescription: string;
  sponsor?: string;
}

export interface NujReceived {
  id: string;
  fromMateId: string;
  fromMateName: string;
  fromMateInitials: string;
  time: string;
}

const GROUPS_STORAGE_KEY = "nuj.groups.v2";

export const mates: Mate[] = [
  { id: "1", name: "Tom Shelby", initials: "TS", lastCheckin: "today", group: "Five-a-side" },
  { id: "2", name: "Jamie Carr", initials: "JC", lastCheckin: "today", group: "Five-a-side" },
  { id: "3", name: "Marcus Reid", initials: "MR", lastCheckin: "yesterday", group: "Uni Lot" },
  { id: "4", name: "Dan Powell", initials: "DP", lastCheckin: "few-days", group: "Uni Lot" },
  { id: "5", name: "Luke Haines", initials: "LH", lastCheckin: "today" },
  { id: "6", name: "Sam Okafor", initials: "SO", lastCheckin: "yesterday", group: "Five-a-side" },
  { id: "7", name: "Rory Flynn", initials: "RF", lastCheckin: "few-days" },
  { id: "8", name: "Aiden Blake", initials: "AB", lastCheckin: "today", group: "Five-a-side" },
  { id: "9", name: "Ben Carter", initials: "BC", lastCheckin: "yesterday" },
  { id: "10", name: "Callum Dean", initials: "CD", lastCheckin: "few-days", group: "Uni Lot" },
  { id: "11", name: "Ethan Ford", initials: "EF", lastCheckin: "today", group: "Five-a-side" },
  { id: "12", name: "Finley Grant", initials: "FG", lastCheckin: "yesterday" },
  { id: "13", name: "George Hale", initials: "GH", lastCheckin: "few-days", group: "Uni Lot" },
  { id: "14", name: "Harry Irwin", initials: "HI", lastCheckin: "today", group: "Five-a-side" },
  { id: "15", name: "Isaac Jones", initials: "IJ", lastCheckin: "yesterday", group: "Uni Lot" },
  { id: "16", name: "Jacob King", initials: "JK", lastCheckin: "few-days" },
  { id: "17", name: "Kai Lewis", initials: "KL", lastCheckin: "today", group: "Five-a-side" },
  { id: "18", name: "Leon Mason", initials: "LM", lastCheckin: "yesterday" },
  { id: "19", name: "Mason North", initials: "MN", lastCheckin: "few-days", group: "Uni Lot" },
  { id: "20", name: "Noah Owen", initials: "NO", lastCheckin: "today" },
  { id: "21", name: "Ollie Price", initials: "OP", lastCheckin: "yesterday", group: "Five-a-side" },
  { id: "22", name: "Parker Quinn", initials: "PQ", lastCheckin: "few-days" },
];

const defaultGroups: Group[] = [
  { id: "g1", name: "Five-a-side", mates: ["1", "2", "6", "8", "11", "14", "17", "21"] },
  { id: "g2", name: "Uni Lot", mates: ["3", "4", "10", "13", "15", "19"] },
];

const isValidGroup = (value: unknown): value is Group => {
  if (!value || typeof value !== "object") return false;

  const maybeGroup = value as Partial<Group>;
  return (
    typeof maybeGroup.id === "string"
    && typeof maybeGroup.name === "string"
    && Array.isArray(maybeGroup.mates)
    && maybeGroup.mates.every((mateId) => typeof mateId === "string")
  );
};

const loadGroupsFromStorage = (): Group[] => {
  if (typeof window === "undefined") return [...defaultGroups];

  try {
    const rawValue = window.localStorage.getItem(GROUPS_STORAGE_KEY);
    if (!rawValue) return [...defaultGroups];

    const parsedValue: unknown = JSON.parse(rawValue);
    if (!Array.isArray(parsedValue)) return [...defaultGroups];

    const validGroups = parsedValue.filter(isValidGroup);
    return validGroups.length > 0 ? validGroups : [...defaultGroups];
  } catch {
    return [...defaultGroups];
  }
};

export const saveGroupsToStorage = (nextGroups: Group[]) => {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(nextGroups));
};

export const groups: Group[] = loadGroupsFromStorage();

export const nujsReceived: NujReceived[] = [
  { id: "n1", fromMateId: "1", fromMateName: "Tom Shelby", fromMateInitials: "TS", time: "2h ago" },
  { id: "n2", fromMateId: "5", fromMateName: "Luke Haines", fromMateInitials: "LH", time: "4h ago" },
  { id: "n3", fromMateId: "8", fromMateName: "Aiden Blake", fromMateInitials: "AB", time: "5h ago" },
  { id: "n4", fromMateId: "11", fromMateName: "Ethan Ford", fromMateInitials: "EF", time: "Yesterday" },
];

export const meetUps: MeetUp[] = [
  {
    id: "m1",
    title: "Post-match pint",
    description: "Head to The Crown after Saturday five-a-side",
    location: "London",
    activityType: "Drinks",
    participantsRequired: 3,
    participatingMates: ["1", "2"],
    rewardDescription: "Round of drinks on us when 3 mates check in together",
    sponsor: "The Crown",
  },
  {
    id: "m2",
    title: "Live at Brixton Academy",
    description: "2-for-1 tickets to Friday's show for reconnected friends",
    location: "London",
    activityType: "Live Music",
    participantsRequired: 2,
    participatingMates: ["3"],
    rewardDescription: "Two tickets for the price of one — bring a mate",
    sponsor: "Brixton Academy",
  },
  {
    id: "m3",
    title: "Sunday afternoon kickabout",
    description: "Clapham Common, bring whoever's around",
    location: "Clapham",
    activityType: "Sport",
    participantsRequired: 4,
    participatingMates: ["1", "6"],
    rewardDescription: "Free post-match wrap from Urban Eat when 4 players check in",
    sponsor: "Urban Eat",
  },
];

export const presenceLabel = (status: PresenceStatus): string => {
  switch (status) {
    case "today": return "Today";
    case "yesterday": return "Yesterday";
    case "few-days": return "A few days ago";
  }
};
