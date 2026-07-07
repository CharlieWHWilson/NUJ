import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "social.nuj.app",
  appName: "NUJ",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
};

export default config;
