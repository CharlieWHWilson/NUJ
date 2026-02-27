import { Mate, PresenceStatus, presenceLabel } from "@/data/mockData";
import { cn } from "@/lib/utils";

interface MateAvatarProps {
  initials: string;
  size?: "sm" | "md" | "lg";
  status?: PresenceStatus;
}

export const MateAvatar = ({ initials, size = "md", status }: MateAvatarProps) => {
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-11 h-11 text-sm",
    lg: "w-16 h-16 text-lg",
  };

  return (
    <div className={cn("relative rounded-full bg-secondary flex items-center justify-center font-semibold text-foreground shrink-0", sizeClasses[size])}>
      {initials}
      {status && (
        <span
          className={cn(
            "absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-card",
            status === "today" ? "nuj-presence-today" : "",
            status === "yesterday" ? "nuj-presence-yesterday" : "",
            status === "few-days" ? "nuj-presence-few-days" : ""
          )}
          title={presenceLabel(status)}
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
      <MateAvatar initials={mate.initials} status={mate.lastCheckin} />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground truncate">{mate.name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {presenceLabel(mate.lastCheckin)}
          {showGroup && mate.group ? ` · ${mate.group}` : ""}
        </p>
      </div>
    </button>
  );
};
