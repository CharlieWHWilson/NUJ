import { useNavigate } from "react-router-dom";
import { ArrowLeft, Filter } from "lucide-react";
import { meetUps, mates } from "@/data/mockData";
import { MateAvatar } from "@/components/MateComponents";

const MeetUpsHub = () => {
  const navigate = useNavigate();

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

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Meet-Ups</h1>
          <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 bg-muted rounded-full">
            <Filter size={13} />
            Filter
          </button>
        </div>
        <p className="text-muted-foreground text-sm mt-2">
          Shared experiences for reconnected friends.
        </p>
      </div>

      <div className="px-5 space-y-4 pb-16">
        {meetUps.map((meetup) => {
          const participatingMatesData = mates.filter((m) => meetup.participatingMates.includes(m.id));
          const remaining = meetup.participantsRequired - meetup.participatingMates.length;
          const progress = meetup.participatingMates.length / meetup.participantsRequired;

          return (
            <button
              key={meetup.id}
              onClick={() => navigate(`/meetup/${meetup.id}`)}
              className="w-full nuj-card p-5 text-left block"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider" style={{ letterSpacing: "0.08em" }}>
                    {meetup.activityType}
                  </span>
                  <h3 className="font-semibold text-base mt-1">{meetup.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{meetup.description}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${progress * 100}%`,
                    background: "hsl(var(--accent))",
                  }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex -space-x-2">
                  {participatingMatesData.map((m) => (
                    <MateAvatar key={m.id} initials={m.initials} size="sm" />
                  ))}
                  {remaining > 0 && (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground font-medium border-2 border-card">
                      +{remaining}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {meetup.participatingMates.length} of {meetup.participantsRequired} in
                </p>
              </div>

              {meetup.sponsor && (
                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
                  In partnership with {meetup.sponsor}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MeetUpsHub;
