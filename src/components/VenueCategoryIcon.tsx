import { Beer, Coffee, Ellipsis, Footprints, Ticket } from "lucide-react";
import type { VenueCategory } from "@/lib/meetups";

const categoryIcons = { cafe: Coffee, pub: Beer, entertainment: Ticket, activity: Footprints, other: Ellipsis };

export const VenueCategoryIcon = ({ category = "other", size = 20, decorative = false }: { category?: VenueCategory; size?: number; decorative?: boolean }) => {
  const Icon = categoryIcons[category];
  return <span className="inline-flex shrink-0 text-muted-foreground" role={decorative ? undefined : "img"} aria-hidden={decorative || undefined} aria-label={decorative ? undefined : `Category: ${category}`} title={category}>
    <Icon size={size} aria-hidden="true" />
  </span>;
};
