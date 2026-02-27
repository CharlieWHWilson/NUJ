import { Mate, PresenceStatus, presenceLabel } from "@/data/mockData";
import { cn } from "@/lib/utils";

interface MateAvatarProps {
  initials: string;
  size?: "sm" | "md" | "lg";
  status?: PresenceStatus;
  daysSinceCheckin?: number;
}

const getDaysSinceCheckin = (status: PresenceStatus, daysSinceCheckin?: number) => {
  if (typeof daysSinceCheckin === "number") return daysSinceCheckin;
  if (status === "today") return 0;
  if (status === "yesterday") return 1;
  return 3;
};

const getPresenceColor = (days: number) => {
  if (days <= 1) return "hsl(120 70% 42%)";
  if (days >= 5) return "hsl(var(--destructive))";

  if (days <= 3) {
    const ratio = (days - 1) / 2;
    const hue = 120 - ((120 - 38) * ratio);
    return `hsl(${hue} 78% 45%)`;
  }

  const ratio = (days - 3) / 2;
  const hue = 38 - (38 * ratio);
  return `hsl(${hue} 78% 45%)`;
};

export const MateAvatar = ({ initials, size = "md", status, daysSinceCheckin }: MateAvatarProps) => {
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-11 h-11 text-sm",
    lg: "w-16 h-16 text-lg",
  };

  const todayBadgeClasses = {
    sm: "-bottom-0 -right-0 w-3 h-3 text-[7px] border border-card",
    md: "-bottom-0.5 -right-0.5 w-5 h-5 text-[11px] border-2 border-card",
    lg: "-bottom-1 -right-1 w-6 h-6 text-xs border-2 border-card",
  };

  const activityDotClasses = {
    sm: "bottom-0 right-0 w-1.5 h-1.5 border border-card",
    md: "bottom-0 right-0 w-3 h-3 border-2 border-card",
    lg: "bottom-0 right-0 w-3.5 h-3.5 border-2 border-card",
  };

  const resolvedDays = status ? getDaysSinceCheckin(status, daysSinceCheckin) : null;

  return (
    <div className={cn("relative rounded-full bg-secondary flex items-center justify-center font-semibold text-foreground shrink-0", sizeClasses[size])}>
      {initials}
      {status && status === "today" && (
        <span
          className={cn("absolute rounded-full bg-background flex items-center justify-center", todayBadgeClasses[size])}
          title={presenceLabel(status, resolvedDays ?? undefined)}
        >
          👋
        </span>
      )}
      {status && status !== "today" && resolvedDays !== null && (
        <span
          className={cn("absolute rounded-full", activityDotClasses[size])}
          style={{ backgroundColor: getPresenceColor(resolvedDays) }}
          title={resolvedDays <= 1 ? "Checked in within last 24h" : `${resolvedDays} days since check-in`}
        />
      )}
    </div>
  );
};

interface MateRowProps {
  mate: Mate;
  onClick?: () => void;
  showGroup?: boolean;
}

export const MateRow = ({ mate, onClick, showGroup = true }: MateRowProps) => {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-3 px-1 hover:bg-muted/50 rounded-xl transition-colors text-left"
    >
      <MateAvatar initials={mate.initials} status={mate.lastCheckin} daysSinceCheckin={mate.daysSinceCheckin} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground truncate">{mate.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {presenceLabel(mate.lastCheckin, mate.daysSinceCheckin)}
          {showGroup && mate.group ? ` · ${mate.group}` : ""}
        </p>
      </div>
    </button>
  );
};
