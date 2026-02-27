import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { mates } from "@/data/mockData";
import { MateRow } from "@/components/MateComponents";

type MatesFilter = "all" | "today" | "yesterday" | "few-days";

const MatesHub = () => {
  const navigate = useNavigate();
  const [matesFilter, setMatesFilter] = useState<MatesFilter>("all");

  const sortedMates = [...mates].sort((a, b) => {
    const order = { today: 0, yesterday: 1, "few-days": 2 };
    return order[a.lastCheckin] - order[b.lastCheckin];
  });

  const filteredMates = sortedMates.filter((mate) => {
    if (matesFilter === "all") return true;
    return mate.lastCheckin === matesFilter;
  });

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      <div className="px-5 pt-12 pb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back</span>
        </button>

        <h1 className="text-2xl font-bold tracking-tight">Mates</h1>
        <p className="text-muted-foreground text-sm mt-1">{mates.length} mates</p>
      </div>

      <div className="px-5 pb-16">
        <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
          <span className="text-xs text-muted-foreground shrink-0">Last checked in:</span>
          {([
            { key: "all", label: "All" },
            { key: "today", label: "Today" },
            { key: "yesterday", label: "Yesterday" },
            { key: "few-days", label: "Few days" },
          ] as Array<{ key: MatesFilter; label: string }>).map((option) => (
            <button
              key={option.key}
              onClick={() => setMatesFilter(option.key)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors whitespace-nowrap ${
                matesFilter === option.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="nuj-card p-4 divide-y divide-border/50">
          {filteredMates.map((mate) => (
            <MateRow
              key={mate.id}
              mate={mate}
              onClick={() => navigate(`/mate/${mate.id}`)}
            />
          ))}
          {filteredMates.length === 0 && (
            <p className="text-xs text-muted-foreground py-3 px-1">No mates for this filter.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatesHub;
