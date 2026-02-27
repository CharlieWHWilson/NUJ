import { useNavigate } from "react-router-dom";
import { ArrowLeft, Filter } from "lucide-react";
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

const MeetUpsHub = () => {
  const navigate = useNavigate();
  const { hasJoinedMeetup, joinMeetup } = useJoinedMeetups();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);

  const categories = Array.from(new Set(meetUps.map((meetup) => meetup.activityType)));

  const filteredByCategory = meetUps.filter((meetup) => {
    if (selectedCategories.length === 0) return true;
    return selectedCategories.includes(meetup.activityType);
  });

  const sortedMeetups = [...filteredByCategory].sort((a, b) => {
    const aJoined = hasJoinedMeetup(a.id) ? 1 : 0;
    const bJoined = hasJoinedMeetup(b.id) ? 1 : 0;
    return bJoined - aJoined;
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
        {sortedMeetups.map((meetup) => {
          const isJoined = hasJoinedMeetup(meetup.id);
          const participatingMatesData = mates.filter((m) => meetup.participatingMates.includes(m.id));
          const totalJoined = Math.min(meetup.participantsRequired, participatingMatesData.length + (isJoined ? 1 : 0));
          const remaining = meetup.participantsRequired - totalJoined;
          const progress = totalJoined / meetup.participantsRequired;

          return (
            <div
              key={meetup.id}
              className="w-full nuj-card p-5 text-left"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider" style={{ letterSpacing: "0.08em" }}>
                    {meetup.activityType}
                  </span>
                  <h3 className="font-semibold text-base mt-1">{meetup.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{meetup.description}</p>
                </div>
                {!isJoined && (
                  <button
                    onClick={() => joinMeetup(meetup.id)}
                    className="nuj-btn-primary px-3 py-1.5 text-xs shrink-0"
                  >
                    Join
                  </button>
                )}
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
                  {totalJoined} of {meetup.participantsRequired} in
                </p>
              </div>

              <button
                onClick={() => navigate(`/meetup/${meetup.id}`)}
                className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View details →
              </button>

              {meetup.sponsor && (
                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
                  In partnership with {meetup.sponsor}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MeetUpsHub;
