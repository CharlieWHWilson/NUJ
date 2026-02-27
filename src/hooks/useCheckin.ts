import { useState } from "react";

const STORAGE_KEY = "nuj_checkin_date";

export const useCheckin = () => {
  const today = new Date().toDateString();
  const stored = localStorage.getItem(STORAGE_KEY);
  const [checkedIn, setCheckedIn] = useState(stored === today);

  const doCheckin = () => {
    localStorage.setItem(STORAGE_KEY, today);
    setCheckedIn(true);
  };

  return { checkedIn, doCheckin };
};
