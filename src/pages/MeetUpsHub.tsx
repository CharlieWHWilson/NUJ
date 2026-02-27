import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronDown, Filter } from "lucide-react";
import { meetUps, mates } from "@/data/mockData";
import { MateAvatar } from "@/components/MateComponents";
import { useJoinedMeetups } from "@/hooks/useJoinedMeetups";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const MeetUpsHub = () => {
  const navigate = useNavigate();
  const { hasJoinedMeetup, joinMeetup, leaveMeetup } = useJoinedMeetups();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [joinedOpen, setJoinedOpen] = useState(true);
  const [notJoinedOpen, setNotJoinedOpen] = useState(true);

  const categories = Array.from(new Set(meetUps.map((meetup) => meetup.activityType)));

  const filteredByCategory = meetUps.filter((meetup) => {
    if (selectedCategories.length === 0) return true;
    return selectedCategories.includes(meetup.activityType);
  });

  const joinedMeetups = filteredByCategory.filter((meetup) => hasJoinedMeetup(meetup.id));
  const notJoinedMeetups = filteredByCategory.filter((meetup) => !hasJoinedMeetup(meetup.id));

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 bg-muted rounded-full">
                <Filter size={13} />
                {selectedCategories.length > 0 ? `Filter (${selectedCategories.length})` : "Filter"}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Categories</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {categories.map((category) => (
                <DropdownMenuCheckboxItem
                  key={category}
                  checked={selectedCategories.includes(category)}
                  onCheckedChange={(checked) => {
                    setSelectedCategories((current) => {
                      if (checked) {
                        if (current.includes(category)) return current;
                        return [...current, category];
                      }
                      return current.filter((item) => item !== category);
                    });
                  }}
                >
                  {category}
                </DropdownMenuCheckboxItem>
              ))}
              <DropdownMenuSeparator />
              <button
                onClick={() => setSelectedCategories([])}
                className="w-full text-left px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-sm transition-colors"
              >
                Clear filters
              </button>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <p className="text-muted-foreground text-sm mt-2">
          Shared experiences for reconnected friends.
        </p>
      </div>

      <div className="px-5 space-y-4 pb-16">
        <div className="nuj-card p-4">
          <Collapsible open={joinedOpen} onOpenChange={setJoinedOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between text-left mb-3">
                <h2 className="font-semibold text-sm tracking-tight">Joined meet-ups</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{joinedMeetups.length}</span>
                  <ChevronDown
                    size={16}
                    className={`text-muted-foreground transition-transform ${joinedOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="grid grid-cols-2 gap-2">
            {joinedMeetups.map((meetup) => {
              const isJoined = hasJoinedMeetup(meetup.id);
              const participatingMatesData = mates.filter((m) => meetup.participatingMates.includes(m.id));
              const totalJoined = Math.min(meetup.participantsRequired, participatingMatesData.length + (isJoined ? 1 : 0));
              const remaining = meetup.participantsRequired - totalJoined;
              const progress = totalJoined / meetup.participantsRequired;

              return (
                <div
                  key={meetup.id}
                  className="w-full bg-muted/40 rounded-xl p-3 text-left"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider" style={{ letterSpacing: "0.08em" }}>
                        {meetup.activityType}
                      </span>
                      <h3 className="font-semibold text-sm mt-0.5 line-clamp-1">{meetup.title}</h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{meetup.description}</p>
                    </div>
                    <button
                      onClick={() => leaveMeetup(meetup.id)}
                      className="px-2 py-1 text-[11px] shrink-0 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Leave
                    </button>
                  </div>

                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
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
                      {participatingMatesData.slice(0, 2).map((m) => (
                        <MateAvatar key={m.id} initials={m.initials} size="sm" status={m.lastCheckin} daysSinceCheckin={m.daysSinceCheckin} />
                      ))}
                      {remaining > 0 && (
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground font-medium border-2 border-card">
                          +{remaining}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {totalJoined} of {meetup.participantsRequired} in
                    </p>
                  </div>

                  <button
                    onClick={() => navigate(`/meetup/${meetup.id}`)}
                    className="mt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    View details →
                  </button>

                  {meetup.sponsor && (
                    <p className="text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border/50 line-clamp-1">
                      In partnership with {meetup.sponsor}
                    </p>
                  )}
                </div>
              );
            })}

            {joinedMeetups.length === 0 && (
              <p className="text-xs text-muted-foreground py-1 col-span-2">You haven't joined any meet-ups yet.</p>
            )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="nuj-card p-4">
          <Collapsible open={notJoinedOpen} onOpenChange={setNotJoinedOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between text-left mb-3">
                <h2 className="font-semibold text-sm tracking-tight">Not joined meet-ups</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{notJoinedMeetups.length}</span>
                  <ChevronDown
                    size={16}
                    className={`text-muted-foreground transition-transform ${notJoinedOpen ? "rotate-180" : ""}`}
                  />
                </div>
              </button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="grid grid-cols-2 gap-2">
            {notJoinedMeetups.map((meetup) => {
          const isJoined = hasJoinedMeetup(meetup.id);
          const participatingMatesData = mates.filter((m) => meetup.participatingMates.includes(m.id));
          const totalJoined = Math.min(meetup.participantsRequired, participatingMatesData.length + (isJoined ? 1 : 0));
          const remaining = meetup.participantsRequired - totalJoined;
          const progress = totalJoined / meetup.participantsRequired;

          return (
            <div
              key={meetup.id}
              className="w-full bg-muted/40 rounded-xl p-3 text-left"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider" style={{ letterSpacing: "0.08em" }}>
                    {meetup.activityType}
                  </span>
                  <h3 className="font-semibold text-sm mt-0.5 line-clamp-1">{meetup.title}</h3>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{meetup.description}</p>
                </div>
                <button
                  onClick={() => joinMeetup(meetup.id)}
                  className="nuj-btn-primary px-2 py-1 text-[11px] shrink-0"
                >
                  Join
                </button>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2">
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
                  {participatingMatesData.slice(0, 2).map((m) => (
                    <MateAvatar key={m.id} initials={m.initials} size="sm" status={m.lastCheckin} daysSinceCheckin={m.daysSinceCheckin} />
                  ))}
                  {remaining > 0 && (
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs text-muted-foreground font-medium border-2 border-card">
                      +{remaining}
                    </div>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {totalJoined} of {meetup.participantsRequired} in
                </p>
              </div>

              <button
                onClick={() => navigate(`/meetup/${meetup.id}`)}
                className="mt-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                View details →
              </button>

              {meetup.sponsor && (
                <p className="text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border/50 line-clamp-1">
                  In partnership with {meetup.sponsor}
                </p>
              )}
            </div>
          );
            })}

            {notJoinedMeetups.length === 0 && (
              <p className="text-xs text-muted-foreground py-1 col-span-2">You've joined all meet-ups in this filter.</p>
            )}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
};

export default MeetUpsHub;
