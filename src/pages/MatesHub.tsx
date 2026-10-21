import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { MateRow } from "@/components/MateComponents";
import { Slider } from "@/components/ui/slider";
import { AddMateSheet } from "@/components/AddMateSheet";
import { useMateConnections } from "@/hooks/useMateConnections";
import { MateRequestsPanel } from "@/components/MateRequestsPanel";

const getDaysSinceCheckin = (mate: { lastCheckin: "today" | "yesterday" | "few-days"; daysSinceCheckin?: number }) => {
  if (typeof mate.daysSinceCheckin === "number") return mate.daysSinceCheckin;
  if (mate.lastCheckin === "today") return 0;
  if (mate.lastCheckin === "yesterday") return 1;
  return 3;
};

const MatesHub = () => {
  const navigate = useNavigate();
  const [matesDayRange, setMatesDayRange] = useState<[number, number]>([0, 31]);
  const connections = useMateConnections();
  const { mates, refresh: refreshMates } = connections;
  const [addMateOpen, setAddMateOpen] = useState(false);

  const sortedMates = [...mates].sort((a, b) => getDaysSinceCheckin(a) - getDaysSinceCheckin(b));

  const filteredMates = sortedMates.filter((mate) => {
    const daysSinceCheckin = getDaysSinceCheckin(mate);
    const [minDays, maxDays] = matesDayRange;
    // The slider's top stop means "31+ days", so older mates are never hidden.
    return daysSinceCheckin >= minDays && (maxDays >= 31 || daysSinceCheckin <= maxDays);
  });

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      <div className="px-2 pb-2 nuj-safe-top-section">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back</span>
        </button>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Mates</h1>
          <button
            onClick={() => setAddMateOpen(true)}
            className="w-7 h-7 flex items-center justify-center rounded-full bg-muted text-foreground hover:bg-secondary transition-colors"
            aria-label="Add mate"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      <div className="px-5 nuj-safe-bottom-page">
        <MateRequestsPanel connections={connections} />
        <div className="mb-3">
          <div className="flex justify-start mb-2">
            <span className="text-xs text-muted-foreground">{filteredMates.length} not checked in for {matesDayRange[0]} days</span>
          </div>
          <Slider
            value={matesDayRange}
            min={0}
            max={31}
            step={1}
            onValueChange={(value) => {
              if (value.length < 2) return;
              setMatesDayRange([value[0] ?? 0, value[1] ?? 31]);
            }}
          />
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
      {addMateOpen && (
        <AddMateSheet open={addMateOpen} onClose={() => setAddMateOpen(false)} onMateAdded={() => void refreshMates()} />
      )}
    </div>
  );
};

export default MatesHub;
