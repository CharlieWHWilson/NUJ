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

export const mates: Mate[] = [
  { id: "1", name: "Tom Shelby", initials: "TS", lastCheckin: "today", group: "Five-a-side" },
  { id: "2", name: "Jamie Carr", initials: "JC", lastCheckin: "today", group: "Five-a-side" },
  { id: "3", name: "Marcus Reid", initials: "MR", lastCheckin: "yesterday", group: "Uni Lot" },
  { id: "4", name: "Dan Powell", initials: "DP", lastCheckin: "few-days", group: "Uni Lot" },
  { id: "5", name: "Luke Haines", initials: "LH", lastCheckin: "today" },
  { id: "6", name: "Sam Okafor", initials: "SO", lastCheckin: "yesterday", group: "Five-a-side" },
  { id: "7", name: "Rory Flynn", initials: "RF", lastCheckin: "few-days" },
];

export const groups: Group[] = [
  { id: "g1", name: "Five-a-side", mates: ["1", "2", "6"] },
  { id: "g2", name: "Uni Lot", mates: ["3", "4"] },
];

export const nujsReceived: NujReceived[] = [
  { id: "n1", fromMateId: "1", fromMateName: "Tom Shelby", fromMateInitials: "TS", time: "2h ago" },
  { id: "n2", fromMateId: "5", fromMateName: "Luke Haines", fromMateInitials: "LH", time: "4h ago" },
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
