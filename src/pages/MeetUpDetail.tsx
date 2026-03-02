import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, Users, Link2, MessageSquare, Mail, Phone } from "lucide-react";
import { meetUps, mates } from "@/data/mockData";
import { MateAvatar } from "@/components/MateComponents";
import { useJoinedMeetups } from "@/hooks/useJoinedMeetups";
import { getCurrentUser } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const MeetUpDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [shareOpen, setShareOpen] = useState(false);
  const { hasJoinedMeetup, joinMeetup, leaveMeetup } = useJoinedMeetups();
  const meetup = meetUps.find((m) => m.id === id);

  if (!meetup) return null;

  const isJoined = hasJoinedMeetup(meetup.id);
  const currentUser = getCurrentUser();
  const currentUserName = currentUser?.name?.trim() || "You";
  const currentUserInitials = currentUserName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "YU";
  const participatingMatesData = mates.filter((m) => meetup.participatingMates.includes(m.id));
  const totalJoined = Math.min(meetup.participantsRequired, participatingMatesData.length + (isJoined ? 1 : 0));
  const remaining = meetup.participantsRequired - totalJoined;
  const progress = totalJoined / meetup.participantsRequired;
  const shareLink = typeof window === "undefined"
    ? `${import.meta.env.BASE_URL}meetup/${meetup.id}`
    : window.location.href;
  const shareText = `Join me for \"${meetup.title}\" on NUJ`;

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      alert("Link copied");
      setShareOpen(false);
    } catch {
      alert("Unable to copy link on this device.");
    }
  };

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
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-muted-foreground" />
              <h2 className="font-semibold text-sm">Who's in</h2>
            </div>

            <Dialog open={shareOpen} onOpenChange={setShareOpen}>
              <DialogTrigger asChild>
                <button className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                  + share
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Share this meet-up</DialogTitle>
                </DialogHeader>

                <div className="space-y-2">
                  <button
                    onClick={copyShareLink}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left"
                  >
                    <Link2 size={17} className="text-muted-foreground" />
                    <span className="text-sm font-medium">Copy link</span>
                  </button>

                  <button
                    onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareLink}`)}`, "_blank")}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left"
                  >
                    <MessageSquare size={17} className="text-muted-foreground" />
                    <span className="text-sm font-medium">WhatsApp</span>
                  </button>

                  <button
                    onClick={() => window.open(`sms:?&body=${encodeURIComponent(`${shareText} ${shareLink}`)}`, "_blank")}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left"
                  >
                    <Phone size={17} className="text-muted-foreground" />
                    <span className="text-sm font-medium">SMS</span>
                  </button>

                  <button
                    onClick={() => window.open(`mailto:?subject=${encodeURIComponent(`NUJ Meet-up: ${meetup.title}`)}&body=${encodeURIComponent(`${shareText}\n\n${shareLink}`)}`, "_blank")}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left"
                  >
                    <Mail size={17} className="text-muted-foreground" />
                    <span className="text-sm font-medium">Email</span>
                  </button>
                </div>
              </DialogContent>
            </Dialog>
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
            {isJoined && (
              <div className="flex items-center gap-3 py-2">
                <MateAvatar initials={currentUserInitials} size="sm" status="today" daysSinceCheckin={0} />
                <p className="text-sm font-medium">You</p>
              </div>
            )}
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

        {isJoined ? (
          <button
            onClick={() => leaveMeetup(meetup.id)}
            className="w-full p-5 text-center rounded-2xl bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            Leave meet-up
          </button>
        ) : (
          <button
            onClick={() => joinMeetup(meetup.id)}
            className="w-full nuj-btn-primary p-5 text-center"
          >
            I'm in
          </button>
        )}

      </div>
    </div>
  );
};

export default MeetUpDetail;
