import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { mates } from "@/data/mockData";
import { MateRow } from "@/components/MateComponents";

const MatesHub = () => {
  const navigate = useNavigate();

  const sortedMates = [...mates].sort((a, b) => {
    const order = { today: 0, yesterday: 1, "few-days": 2 };
    return order[a.lastCheckin] - order[b.lastCheckin];
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

        <h1 className="text-2xl font-bold tracking-tight">Your Mates</h1>
        <p className="text-muted-foreground text-sm mt-1">{mates.length} mates</p>
      </div>

      <div className="px-5 pb-16">
        <div className="nuj-card p-4 divide-y divide-border/50">
          {sortedMates.map((mate) => (
            <MateRow
              key={mate.id}
              mate={mate}
              onClick={() => navigate(`/mate/${mate.id}`)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default MatesHub;
