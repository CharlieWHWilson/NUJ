import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Users, Zap, CalendarCheck, MapPin } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { MateRow, MateAvatar } from "@/components/MateComponents";
import { mates, groups, nujsReceived, meetUps } from "@/data/mockData";
import { AddMateSheet } from "@/components/AddMateSheet";
import { NujActionSheet } from "@/components/NujActionSheet";
import { useCheckin } from "@/hooks/useCheckin";

const Dashboard = () => {
  const navigate = useNavigate();
  const { checkedIn } = useCheckin();
  const [addMateOpen, setAddMateOpen] = useState(false);
  const [selectedNuj, setSelectedNuj] = useState<string | null>(null);

  const sortedMates = [...mates].sort((a, b) => {
    const order = { today: 0, yesterday: 1, "few-days": 2 };
    return order[a.lastCheckin] - order[b.lastCheckin];
  });

  const todayCount = mates.filter((m) => m.lastCheckin === "today").length;

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      <TopNav onAddMate={() => setAddMateOpen(true)} />

      <div className="px-5 pb-24 space-y-4">
        {/* Checked-In Card */}
        <div className="nuj-card p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "hsl(var(--nuj-amber-light))" }}>
              <span className="text-lg">👋</span>
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {checkedIn ? "You are here today" : "Not checked in yet"}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {checkedIn
                  ? `${todayCount} of your mates are around too`
                  : "Tap to check in and see who's around"}
              </p>
            </div>
            {!checkedIn && (
              <button
                onClick={() => navigate("/")}
                className="ml-auto nuj-btn-primary px-4 py-2 text-sm"
              >
                Check in
              </button>
            )}
          </div>
        </div>

        {/* You've Been NUJ'd */}
        {nujsReceived.length > 0 && (
          <div className="nuj-card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap size={15} className="text-accent" />
                <h2 className="font-semibold text-sm tracking-tight">You've been NUJ'd</h2>
              </div>
              <span className="text-xs text-muted-foreground">{nujsReceived.length}</span>
            </div>
            <div className="space-y-1">
              {nujsReceived.map((nuj) => (
                <button
                  key={nuj.id}
                  onClick={() => setSelectedNuj(nuj.id)}
                  className="w-full flex items-center gap-3 py-2.5 px-1 hover:bg-muted/50 rounded-xl transition-colors text-left"
                >
                  <MateAvatar initials={nuj.fromMateInitials} size="sm" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{nuj.fromMateName}</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{nuj.time}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Your Mates */}
        <div className="nuj-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-muted-foreground" />
              <h2 className="font-semibold text-sm tracking-tight">Your Mates</h2>
            </div>
            <span className="text-xs text-muted-foreground">{mates.length}</span>
          </div>
          <div className="divide-y divide-border/50">
            {sortedMates.slice(0, 5).map((mate) => (
              <MateRow
                key={mate.id}
                mate={mate}
                onClick={() => navigate(`/mate/${mate.id}`)}
              />
            ))}
          </div>
          {mates.length > 5 && (
            <button
              onClick={() => navigate("/mates")}
              className="w-full mt-3 text-sm text-muted-foreground flex items-center justify-center gap-1 hover:text-foreground transition-colors py-1"
            >
              See all {mates.length} mates <ChevronRight size={14} />
            </button>
          )}
        </div>

        {/* Groups */}
        <div className="nuj-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm tracking-tight">Groups</h2>
            <span className="text-xs text-muted-foreground">{groups.length}</span>
          </div>
          <div className="space-y-3">
            {groups.map((group) => {
              const groupMates = mates.filter((m) => group.mates.includes(m.id));
              const todayInGroup = groupMates.filter((m) => m.lastCheckin === "today").length;
              return (
                <button
                  key={group.id}
                  onClick={() => navigate(`/group/${group.id}`)}
                  className="w-full flex items-center gap-3 py-2.5 px-3 bg-muted/40 hover:bg-muted rounded-xl transition-colors text-left"
                >
                  <div className="flex -space-x-2">
                    {groupMates.slice(0, 3).map((m) => (
                      <MateAvatar key={m.id} initials={m.initials} size="sm" />
                    ))}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{group.name}</p>
                    <p className="text-xs text-muted-foreground">{todayInGroup} checked in today</p>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Meet-Ups */}
        <div className="nuj-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-muted-foreground" />
              <h2 className="font-semibold text-sm tracking-tight">Meet-Ups</h2>
            </div>
            <button
              onClick={() => navigate("/meetups")}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
            >
              All <ChevronRight size={12} />
            </button>
          </div>
          <div className="space-y-3">
            {meetUps.slice(0, 2).map((meetup) => {
              const participatingMatesData = mates.filter((m) => meetup.participatingMates.includes(m.id));
              return (
                <button
                  key={meetup.id}
                  onClick={() => navigate(`/meetup/${meetup.id}`)}
                  className="w-full text-left p-4 bg-muted/40 hover:bg-muted rounded-xl transition-colors"
                >
                  <p className="font-medium text-sm">{meetup.title}</p>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{meetup.description}</p>
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex -space-x-1.5">
                      {participatingMatesData.map((m) => (
                        <MateAvatar key={m.id} initials={m.initials} size="sm" />
                      ))}
                      <div className="w-8 h-8 rounded-full bg-border flex items-center justify-center text-xs text-muted-foreground font-medium border-2 border-card">
                        +{meetup.participantsRequired - meetup.participatingMates.length}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {meetup.participatingMates.length}/{meetup.participantsRequired} in
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <AddMateSheet open={addMateOpen} onClose={() => setAddMateOpen(false)} />
      {selectedNuj && (
        <NujActionSheet
          nuj={nujsReceived.find((n) => n.id === selectedNuj)!}
          mate={mates.find((m) => m.id === nujsReceived.find((n) => n.id === selectedNuj)?.fromMateId)!}
          onClose={() => setSelectedNuj(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;
