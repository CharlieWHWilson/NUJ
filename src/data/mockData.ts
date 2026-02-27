export type PresenceStatus = "today" | "yesterday" | "few-days";

export interface Mate {
  id: string;
  name: string;
  initials: string;
  lastCheckin: PresenceStatus;
  daysSinceCheckin?: number;
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
  sentAt: string;
}

const GROUPS_STORAGE_KEY = "nuj.groups.v2";

export const mates: Mate[] = [
  { id: "1", name: "Tom Shelby", initials: "TS", lastCheckin: "today", daysSinceCheckin: 0, group: "Five-a-side" },
  { id: "2", name: "Jamie Carr", initials: "JC", lastCheckin: "yesterday", daysSinceCheckin: 1, group: "Five-a-side" },
  { id: "3", name: "Marcus Reid", initials: "MR", lastCheckin: "few-days", daysSinceCheckin: 2, group: "Uni Lot" },
  { id: "4", name: "Dan Powell", initials: "DP", lastCheckin: "few-days", daysSinceCheckin: 3, group: "Uni Lot" },
  { id: "5", name: "Luke Haines", initials: "LH", lastCheckin: "few-days", daysSinceCheckin: 4 },
  { id: "6", name: "Sam Okafor", initials: "SO", lastCheckin: "few-days", daysSinceCheckin: 5, group: "Five-a-side" },
  { id: "7", name: "Rory Flynn", initials: "RF", lastCheckin: "few-days", daysSinceCheckin: 6 },
  { id: "8", name: "Aiden Blake", initials: "AB", lastCheckin: "few-days", daysSinceCheckin: 7, group: "Five-a-side" },
  { id: "9", name: "Ben Carter", initials: "BC", lastCheckin: "few-days", daysSinceCheckin: 8 },
  { id: "10", name: "Callum Dean", initials: "CD", lastCheckin: "few-days", daysSinceCheckin: 9, group: "Uni Lot" },
  { id: "11", name: "Ethan Ford", initials: "EF", lastCheckin: "few-days", daysSinceCheckin: 10, group: "Five-a-side" },
  { id: "12", name: "Finley Grant", initials: "FG", lastCheckin: "few-days", daysSinceCheckin: 12 },
  { id: "13", name: "George Hale", initials: "GH", lastCheckin: "few-days", daysSinceCheckin: 14, group: "Uni Lot" },
  { id: "14", name: "Harry Irwin", initials: "HI", lastCheckin: "few-days", daysSinceCheckin: 16, group: "Five-a-side" },
  { id: "15", name: "Isaac Jones", initials: "IJ", lastCheckin: "few-days", daysSinceCheckin: 18, group: "Uni Lot" },
  { id: "16", name: "Jacob King", initials: "JK", lastCheckin: "few-days", daysSinceCheckin: 20 },
  { id: "17", name: "Kai Lewis", initials: "KL", lastCheckin: "few-days", daysSinceCheckin: 22, group: "Five-a-side" },
  { id: "18", name: "Leon Mason", initials: "LM", lastCheckin: "few-days", daysSinceCheckin: 24 },
  { id: "19", name: "Mason North", initials: "MN", lastCheckin: "few-days", daysSinceCheckin: 26, group: "Uni Lot" },
  { id: "20", name: "Noah Owen", initials: "NO", lastCheckin: "few-days", daysSinceCheckin: 28 },
  { id: "21", name: "Ollie Price", initials: "OP", lastCheckin: "few-days", daysSinceCheckin: 30, group: "Five-a-side" },
  { id: "22", name: "Parker Quinn", initials: "PQ", lastCheckin: "few-days", daysSinceCheckin: 31 },
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

const toIsoFromNowOffset = (millisecondsAgo: number): string => {
  return new Date(Date.now() - millisecondsAgo).toISOString();
};

export const nujsReceived: NujReceived[] = [
  { id: "n1", fromMateId: "1", fromMateName: "Tom Shelby", fromMateInitials: "TS", sentAt: toIsoFromNowOffset(2 * 60 * 60 * 1000) },
  { id: "n2", fromMateId: "5", fromMateName: "Luke Haines", fromMateInitials: "LH", sentAt: toIsoFromNowOffset(4 * 60 * 60 * 1000) },
  { id: "n3", fromMateId: "8", fromMateName: "Aiden Blake", fromMateInitials: "AB", sentAt: toIsoFromNowOffset(5 * 60 * 60 * 1000) },
  { id: "n4", fromMateId: "11", fromMateName: "Ethan Ford", fromMateInitials: "EF", sentAt: toIsoFromNowOffset(28 * 60 * 60 * 1000) },
];

export const formatNujTimestamp = (sentAt: string): string => {
  const sentTime = new Date(sentAt).getTime();
  if (Number.isNaN(sentTime)) return "Just now";

  const secondsAgo = Math.floor((Date.now() - sentTime) / 1000);
  if (secondsAgo < 60) return "Just now";

  const minutesAgo = Math.floor(secondsAgo / 60);
  if (minutesAgo < 60) return `${minutesAgo}m ago`;

  const hoursAgo = Math.floor(minutesAgo / 60);
  if (hoursAgo < 24) return `${hoursAgo}h ago`;

  const daysAgo = Math.floor(hoursAgo / 24);
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 7) return `${daysAgo}d ago`;

  return new Date(sentAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
};

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
  {
    id: "m4",
    title: "Coffee catch-up",
    description: "Quick morning coffee before work",
    location: "Shoreditch",
    activityType: "Coffee",
    participantsRequired: 2,
    participatingMates: ["5"],
    rewardDescription: "Free pastry when 2 mates check in",
    sponsor: "Bean & Co",
  },
  {
    id: "m5",
    title: "Midweek pub quiz",
    description: "Team up for trivia night at the local",
    location: "Camden",
    activityType: "Quiz",
    participantsRequired: 4,
    participatingMates: ["2", "6"],
    rewardDescription: "Discounted entry for NUJ groups",
    sponsor: "The Fox",
  },
  {
    id: "m6",
    title: "After-work run",
    description: "5k social run around the park",
    location: "Battersea",
    activityType: "Fitness",
    participantsRequired: 3,
    participatingMates: ["1"],
    rewardDescription: "Free smoothie for every runner",
    sponsor: "Pulse Bar",
  },
  {
    id: "m7",
    title: "Street food crawl",
    description: "Try 3 spots and vote the winner",
    location: "Borough",
    activityType: "Food",
    participantsRequired: 3,
    participatingMates: ["3", "4"],
    rewardDescription: "2-for-1 voucher at final stop",
    sponsor: "Market Lane",
  },
  {
    id: "m8",
    title: "Board game night",
    description: "Bring your best strategy and snacks",
    location: "Clapham",
    activityType: "Games",
    participantsRequired: 4,
    participatingMates: ["7"],
    rewardDescription: "Free table booking for NUJ mates",
    sponsor: "Dice Den",
  },
  {
    id: "m9",
    title: "Cinema Tuesday",
    description: "Catch the latest release together",
    location: "Leicester Square",
    activityType: "Cinema",
    participantsRequired: 2,
    participatingMates: ["8"],
    rewardDescription: "Popcorn combo upgrade",
    sponsor: "City Screens",
  },
  {
    id: "m10",
    title: "Sunday roast link-up",
    description: "Classic roast and catch-up",
    location: "Richmond",
    activityType: "Food",
    participantsRequired: 3,
    participatingMates: ["10", "13"],
    rewardDescription: "Complimentary dessert",
    sponsor: "The Oak Room",
  },
  {
    id: "m11",
    title: "Rooftop sunset drinks",
    description: "Golden hour with the crew",
    location: "Waterloo",
    activityType: "Drinks",
    participantsRequired: 3,
    participatingMates: ["11", "14"],
    rewardDescription: "Happy hour extension",
    sponsor: "Skyline Bar",
  },
  {
    id: "m12",
    title: "Saturday market walk",
    description: "Browse stalls and grab brunch",
    location: "Notting Hill",
    activityType: "Social",
    participantsRequired: 2,
    participatingMates: ["12"],
    rewardDescription: "Free coffee refill",
    sponsor: "West Market",
  },
  {
    id: "m13",
    title: "Open mic night",
    description: "Live music and chilled vibes",
    location: "Hackney",
    activityType: "Live Music",
    participantsRequired: 3,
    participatingMates: ["15", "19"],
    rewardDescription: "Priority entry for NUJ groups",
    sponsor: "The Stage",
  },
];

export const presenceLabel = (status: PresenceStatus, daysSinceCheckin?: number): string => {
  if (typeof daysSinceCheckin === "number") {
    if (daysSinceCheckin <= 0) return "Today";
    if (daysSinceCheckin === 1) return "Yesterday";
    return `${daysSinceCheckin} days ago`;
  }

  switch (status) {
    case "today": return "Today";
    case "yesterday": return "Yesterday";
    case "few-days": return "A few days ago";
  }
};
