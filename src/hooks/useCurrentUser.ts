import { useEffect, useState } from "react";
import { AuthUser, getCurrentUser } from "@/lib/auth";

export const useCurrentUser = () => {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  useEffect(() => {
    let active = true;

    getCurrentUser().then((u) => {
      if (active) setUser(u);
    });

    return () => {
      active = false;
    };
  }, []);

  return user;
};
