import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { mates } from "@/data/mockData";
import { MateRow } from "@/components/MateComponents";
import { Slider } from "@/components/ui/slider";
import { AddMateSheet } from "@/components/AddMateSheet";

const getDaysSinceCheckin = (mate: { lastCheckin: "today" | "yesterday" | "few-days"; daysSinceCheckin?: number }) => {
  if (typeof mate.daysSinceCheckin === "number") return mate.daysSinceCheckin;
  if (mate.lastCheckin === "today") return 0;
  if (mate.lastCheckin === "yesterday") return 1;
  return 3;
};

const MatesHub = () => {
  const navigate = useNavigate();
  const [matesDayRange, setMatesDayRange] = useState<[number, number]>([0, 31]);

  const sortedMates = [...mates].sort((a, b) => getDaysSinceCheckin(a) - getDaysSinceCheckin(b));

  const filteredMates = sortedMates.filter((mate) => {
    const daysSinceCheckin = getDaysSinceCheckin(mate);
    return daysSinceCheckin >= matesDayRange[0] && daysSinceCheckin <= matesDayRange[1];
  });

  const [addMateOpen, setAddMateOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      <div className="px-2 pt-12 pb-2">
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
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          </button>
        </div>
      </div>

      <div className="px-5 pb-16">
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
        <AddMateSheet open={addMateOpen} onClose={() => setAddMateOpen(false)} />
      )}
    </div>
  );
};

export default MatesHub;
