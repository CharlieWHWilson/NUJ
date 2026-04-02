import { Mate } from "./mockData";

export interface NujSent {
  id: string;
  toMateId: string;
  toMateName: string;
  toMateInitials: string;
  sentAt: string;
}

const toIsoFromNowOffset = (millisecondsAgo: number): string => {
  return new Date(Date.now() - millisecondsAgo).toISOString();
};

const NUJS_SENT_KEY = "nuj-sent";

export const getNujsSent = (): NujSent[] => {
  try {
    const raw = localStorage.getItem(NUJS_SENT_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

export const addNujSent = (nuj: NujSent) => {
  const current = getNujsSent();
  const next = [nuj, ...current];
  localStorage.setItem(NUJS_SENT_KEY, JSON.stringify(next));
};
