import { useState } from "react";

export const CHECKIN_STORAGE_KEY = "nuj_checkin_date_v2";

export const useCheckin = () => {
  const today = new Date().toDateString();
  const stored = localStorage.getItem(CHECKIN_STORAGE_KEY);
  const [checkedIn, setCheckedIn] = useState(stored === today);

  const doCheckin = () => {
    localStorage.setItem(CHECKIN_STORAGE_KEY, today);
    setCheckedIn(true);
  };

  return { checkedIn, doCheckin };
};
