import { UserCircle, Plus } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";

interface TopNavProps {
  onAddMate?: () => void;
}

export const TopNav = ({ onAddMate }: TopNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isCheckin = location.pathname === "/";

  return (
    <div className="flex items-center justify-between px-6 pt-12 pb-4">
      <button
        onClick={() => navigate("/")}
        className="text-2xl font-bold tracking-tight text-foreground select-none"
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
