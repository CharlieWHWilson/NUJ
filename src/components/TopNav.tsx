import { UserCircle, Plus } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";


interface TopNavProps {
  onAddMate?: () => void;
  showButtonsOnly?: boolean;
}


export const TopNav = ({ onAddMate, showButtonsOnly }: TopNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const isCheckin = location.pathname === "/";

  if (showButtonsOnly) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={onAddMate}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-muted text-foreground hover:bg-secondary transition-colors"
          aria-label="Add mate"
        >
          <Plus size={14} strokeWidth={2.2} />
        </button>
        <button
          onClick={() => navigate("/profile")}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-muted text-foreground hover:bg-secondary transition-colors"
          aria-label="Profile"
        >
          <UserCircle size={14} strokeWidth={1.8} />
        </button>
      </div>
    );
  }

  return (
    <div className={`flex items-center px-6 pt-12 pb-4 ${isCheckin ? "justify-center" : "justify-between"}`}>
      <button
        onClick={() => navigate("/")}
        className={`${isCheckin ? "text-3xl" : "text-2xl"} font-bold tracking-tight text-foreground select-none`}
        style={{ letterSpacing: "-0.04em" }}
      >
        NUJ
      </button>
      {!isCheckin && (
        <div className="flex items-center gap-3">
          <button
            onClick={onAddMate}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-muted text-foreground hover:bg-secondary transition-colors"
            aria-label="Add mate"
          >
            <Plus size={18} strokeWidth={2.5} />
          </button>
          <button
            onClick={() => navigate("/profile")}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-muted text-foreground hover:bg-secondary transition-colors"
            aria-label="Profile"
          >
            <UserCircle size={18} strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
};
