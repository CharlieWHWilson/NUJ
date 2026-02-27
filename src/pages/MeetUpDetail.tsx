import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Users } from "lucide-react";
import { meetUps, mates } from "@/data/mockData";
import { MateAvatar } from "@/components/MateComponents";
import { useJoinedMeetups } from "@/hooks/useJoinedMeetups";

const MeetUpDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasJoinedMeetup, joinMeetup } = useJoinedMeetups();
  const meetup = meetUps.find((m) => m.id === id);

  if (!meetup) return null;

  const isJoined = hasJoinedMeetup(meetup.id);
  const participatingMatesData = mates.filter((m) => meetup.participatingMates.includes(m.id));
  const totalJoined = Math.min(meetup.participantsRequired, participatingMatesData.length + (isJoined ? 1 : 0));
  const remaining = meetup.participantsRequired - totalJoined;
  const progress = totalJoined / meetup.participantsRequired;

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

        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider" style={{ letterSpacing: "0.08em" }}>
          {meetup.activityType} · {meetup.location}
        </span>
        <h1 className="text-2xl font-bold tracking-tight mt-2">{meetup.title}</h1>
      </div>

      <div className="px-5 space-y-5 pb-16">
        {/* Description */}
        <div className="nuj-card p-5">
          <p className="text-foreground leading-relaxed">{meetup.description}</p>
        </div>

        {/* Progress */}
        <div className="nuj-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={15} className="text-muted-foreground" />
            <h2 className="font-semibold text-sm">Who's in</h2>
          </div>

          <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-4">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress * 100}%`,
                background: "hsl(var(--accent))",
              }}
            />
          </div>

          <div className="space-y-1">
            {participatingMatesData.map((m) => (
              <div key={m.id} className="flex items-center gap-3 py-2">
                <MateAvatar initials={m.initials} size="sm" status={m.lastCheckin} daysSinceCheckin={m.daysSinceCheckin} />
                <p className="text-sm font-medium">{m.name}</p>
              </div>
            ))}
            {Array.from({ length: remaining }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-2 opacity-40">
                <div className="w-8 h-8 rounded-full bg-border border-2 border-dashed border-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">Waiting for a mate…</p>
              </div>
            ))}
          </div>
        </div>

        {/* Reward */}
        <div
          className="p-5 rounded-2xl"
          style={{ background: "hsl(var(--nuj-amber-light))" }}
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2" style={{ letterSpacing: "0.08em" }}>
            How the reward unlocks
          </p>
          <p className="text-sm font-medium text-foreground leading-relaxed">{meetup.rewardDescription}</p>
          {meetup.sponsor && (
            <p className="text-xs text-muted-foreground mt-3">
              In partnership with {meetup.sponsor}
            </p>
          )}
        </div>

        <button
          onClick={() => joinMeetup(meetup.id)}
          disabled={isJoined}
          className="w-full nuj-btn-primary p-5 text-center disabled:opacity-70 disabled:cursor-default"
        >
          {isJoined ? "You're in" : "I'm in"}
        </button>
      </div>
    </div>
  );
};

export default MeetUpDetail;
