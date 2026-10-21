import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";

export const useAppRefresh = (refresh: () => unknown) => {
  const callback = useRef(refresh);
  callback.current = refresh;

  useEffect(() => {
    const run = () => {
      if (document.hidden) return;
      void Promise.resolve().then(() => callback.current()).catch((error) => console.warn("Unable to refresh app state", error));
    };
    window.addEventListener("focus", run);
    window.addEventListener("nuj:refresh", run);
    document.addEventListener("visibilitychange", run);
    const listener = Capacitor.isNativePlatform()
      ? App.addListener("appStateChange", ({ isActive }) => { if (isActive) run(); })
      : null;
    return () => {
      window.removeEventListener("focus", run);
      window.removeEventListener("nuj:refresh", run);
      document.removeEventListener("visibilitychange", run);
      void listener?.then((handle) => handle.remove());
    };
  }, []);
};