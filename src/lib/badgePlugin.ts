import { registerPlugin } from "@capacitor/core";

export interface BadgePlugin {
  set(options: { count: number }): Promise<{ count: number }>;
  get(): Promise<{ count: number }>;
}

export const Badge = registerPlugin<BadgePlugin>("Badge");
