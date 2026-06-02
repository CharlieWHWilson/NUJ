import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const APP_STORAGE_KEYS = [
  "nuj.mates.v1",
  "nuj.groups.v2",
  "nuj.joined_meetups",
  "nuj-sent",
  "nuj.daily_reminder",
  "nuj_checkin_date_v2",
];

export const clearAppStorage = () => {
  if (typeof window === "undefined") return;
  APP_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
};
