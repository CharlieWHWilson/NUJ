import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, Plus, MapPin } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { MateRow, MateAvatar } from "@/components/MateComponents";
import { mates, groups, nujsReceived, meetUps, saveGroupsToStorage, formatNujTimestamp } from "@/data/mockData";
import { AddMateSheet } from "@/components/AddMateSheet";
import { NujActionSheet } from "@/components/NujActionSheet";
import { useCheckin } from "@/hooks/useCheckin";
import { useJoinedMeetups } from "@/hooks/useJoinedMeetups";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

type SectionKey = "nuj" | "mates" | "groups" | "meetups";
type MatesFilter = "today" | "last-3" | "over-3";

const getDaysSinceCheckin = (mate: { lastCheckin: "today" | "yesterday" | "few-days"; daysSinceCheckin?: number }) => {
  if (typeof mate.daysSinceCheckin === "number") return mate.daysSinceCheckin;
  if (mate.lastCheckin === "today") return 0;
  if (mate.lastCheckin === "yesterday") return 1;
  return 3;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const shouldExpandNuj = Boolean((location.state as { expandNuj?: boolean } | null)?.expandNuj);
  const { checkedIn } = useCheckin();
  const { hasJoinedMeetup } = useJoinedMeetups();
  const [addMateOpen, setAddMateOpen] = useState(false);
  const [selectedNuj, setSelectedNuj] = useState<string | null>(null);
  const [nujCards, setNujCards] = useState(nujsReceived);
  const [groupsList, setGroupsList] = useState(groups);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [groupMateSearch, setGroupMateSearch] = useState("");
  const [newGroupMateIds, setNewGroupMateIds] = useState<string[]>([]);
  const [matesFilter, setMatesFilter] = useState<MatesFilter>("today");
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    nuj: shouldExpandNuj,
    mates: false,
    groups: false,
    meetups: false,
  });

  const sortedMates = [...mates].sort((a, b) => getDaysSinceCheckin(a) - getDaysSinceCheckin(b));

  const filteredMates = sortedMates.filter((mate) => {
    const daysSinceCheckin = getDaysSinceCheckin(mate);
    if (matesFilter === "today") return daysSinceCheckin === 0;
    if (matesFilter === "last-3") return daysSinceCheckin <= 3;
    return daysSinceCheckin > 3;
  });

  const joinedMeetups = meetUps.filter((meetup) => hasJoinedMeetup(meetup.id));

  const setSectionOpen = (section: SectionKey, open: boolean) => {
    setOpenSections((current) => ({ ...current, [section]: open }));
  };

  const completeNujAction = (nujId: string) => {
    setNujCards((currentCards) => currentCards.filter((card) => card.id !== nujId));
    setSelectedNuj(null);
  };

  const selectedNujCard = nujCards.find((nuj) => nuj.id === selectedNuj);
  const selectedNujMate = selectedNujCard
    ? mates.find((mate) => mate.id === selectedNujCard.fromMateId)
    : undefined;

  const filteredMatesForNewGroup = sortedMates.filter((mate) => {
    const search = groupMateSearch.trim().toLowerCase();
    if (!search) return true;
    return mate.name.toLowerCase().includes(search);
  });

  const toggleNewGroupMate = (mateId: string) => {
    setNewGroupMateIds((currentIds) => {
      if (currentIds.includes(mateId)) {
        return currentIds.filter((id) => id !== mateId);
      }
      return [...currentIds, mateId];
    });
  };

  const handleCreateGroup = () => {
    const normalizedName = newGroupName.trim();
    if (!normalizedName || newGroupMateIds.length === 0) return;

    const newGroup = {
      id: `g${Date.now()}`,
      name: normalizedName,
      mates: newGroupMateIds,
    };

    const nextGroups = [...groupsList, newGroup];
    groups.splice(0, groups.length, ...nextGroups);
    saveGroupsToStorage(nextGroups);
    setGroupsList(nextGroups);

    setNewGroupName("");
    setGroupMateSearch("");
    setNewGroupMateIds([]);
    setIsAddingGroup(false);
  };

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      <div className="px-5 pt-5">
        <div
          className={`nuj-card p-4 ${checkedIn ? "cursor-pointer bg-emerald-50/60 border-emerald-200/70" : ""}`}
          onClick={checkedIn ? () => navigate("/") : undefined}
          role={checkedIn ? "button" : undefined}
          tabIndex={checkedIn ? 0 : undefined}
          onKeyDown={checkedIn
            ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                navigate("/");
              }
            }
            : undefined}
        >
          <div className={`flex items-center gap-2.5 ${checkedIn ? "justify-center" : ""}`}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "hsl(var(--nuj-amber-light))" }}>
              <span className="text-base">👋</span>
            </div>
            <div className={checkedIn ? "text-center" : ""}>
              {checkedIn ? (
                <p className="font-medium text-sm text-foreground">
                  You're here today
                </p>
              ) : (
                <p className="font-medium text-sm text-foreground">Not checked in yet</p>
              )}
              {!checkedIn && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tap to check in and see who's around
                </p>
              )}
            </div>
            {!checkedIn && (
              <button
                onClick={() => navigate("/")}
                className="ml-auto nuj-btn-primary px-3 py-1.5 text-xs"
              >
                Check in
              </button>
            )}
          </div>
        </div>
      </div>

      <TopNav onAddMate={() => setAddMateOpen(true)} />

      <div className="px-5 pb-24 space-y-4">
        {/* You've Been NUJ'd */}
        {nujCards.length > 0 && (
          <div className="nuj-card p-4">
            <Collapsible
              open={openSections.nuj}
              onOpenChange={(open) => setSectionOpen("nuj", open)}
            >
              <CollapsibleTrigger asChild>
                <button className="w-full flex items-center justify-between text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm" aria-hidden="true">👉</span>
                    <h2 className="font-semibold text-sm tracking-tight">You have {nujCards.length} NUJs</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <ChevronDown
                      size={16}
                      className={`text-muted-foreground transition-transform ${openSections.nuj ? "rotate-180" : ""}`}
                    />
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {nujCards.map((nuj) => {
                    const nujMate = mates.find((mate) => mate.id === nuj.fromMateId);

                    return (
                      <button
                        key={nuj.id}
                        onClick={() => setSelectedNuj(nuj.id)}
                        className="shrink-0 w-32 p-2 bg-muted/40 hover:bg-muted rounded-xl transition-colors text-left"
                      >
                        <div className="flex items-center gap-1.5">
                          <MateAvatar
                            initials={nuj.fromMateInitials}
                            size="sm"
                            status={nujMate?.lastCheckin}
                            daysSinceCheckin={nujMate?.daysSinceCheckin}
                          />
                          <p className="text-xs font-medium leading-tight line-clamp-2">{nuj.fromMateName}</p>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-1">NUJ'd {formatNujTimestamp(nuj.sentAt)}</p>
                      </button>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        )}

        {/* Groups */}
        <div className="nuj-card p-4">
          <Collapsible
            open={openSections.groups}
            onOpenChange={(open) => setSectionOpen("groups", open)}
          >
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm" aria-hidden="true">👥︎</span>
                  <h2 className="font-semibold text-sm tracking-tight">Groups</h2>
                </div>
                <div className="flex items-center gap-2">
                  {openSections.groups && (
                    <span className="text-xs text-muted-foreground">{groupsList.length}</span>
                  )}
                  <ChevronDown
                    size={16}
                    className={`text-muted-foreground transition-transform ${openSections.groups ? "rotate-180" : ""}`}
                  />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="space-y-3">
                {groupsList.map((group) => {
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
                          <MateAvatar key={m.id} initials={m.initials} size="sm" status={m.lastCheckin} daysSinceCheckin={m.daysSinceCheckin} />
                        ))}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{group.name}</p>
                        <p className="text-xs text-muted-foreground">{todayInGroup}/{groupMates.length} checked in today</p>
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>

              {isAddingGroup && (
                <div className="mt-3 p-3 rounded-xl bg-muted/40 border border-border space-y-3">
                  <Input
                    value={newGroupName}
                    onChange={(event) => setNewGroupName(event.target.value)}
                    placeholder="Group name"
                    aria-label="Group name"
                  />
                  <Input
                    value={groupMateSearch}
                    onChange={(event) => setGroupMateSearch(event.target.value)}
                    placeholder="Search mates"
                    aria-label="Search mates"
                  />

                  <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
                    {filteredMatesForNewGroup.map((mate) => (
                      <button
                        key={mate.id}
                        onClick={() => toggleNewGroupMate(mate.id)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                      >
                        <Checkbox
                          checked={newGroupMateIds.includes(mate.id)}
                          aria-label={`Select ${mate.name}`}
                        />
                        <MateAvatar initials={mate.initials} size="sm" status={mate.lastCheckin} daysSinceCheckin={mate.daysSinceCheckin} />
                        <span className="text-sm font-medium">{mate.name}</span>
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={handleCreateGroup}
                    disabled={!newGroupName.trim() || newGroupMateIds.length === 0}
                    className="w-full nuj-btn-primary h-10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Done
                  </button>
                </div>
              )}

              <div className="flex justify-end mt-3">
                <button
                  onClick={() => setIsAddingGroup((current) => !current)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <Plus size={13} />
                  {isAddingGroup ? "Cancel" : "Add group"}
                </button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Mates */}
        <div className="nuj-card p-4">
          <Collapsible
            open={openSections.mates}
            onOpenChange={(open) => setSectionOpen("mates", open)}
          >
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm" aria-hidden="true">👤︎</span>
                  <h2 className="font-semibold text-sm tracking-tight">Mates</h2>
                </div>
                <div className="flex items-center gap-2">
                  {openSections.mates && (
                    <span className="text-xs text-muted-foreground">{mates.length}</span>
                  )}
                  <ChevronDown
                    size={16}
                    className={`text-muted-foreground transition-transform ${openSections.mates ? "rotate-180" : ""}`}
                  />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="flex items-center gap-2 mb-3 overflow-x-auto pb-1">
                <span className="text-xs text-muted-foreground shrink-0">Last checked in:</span>
                {([
                  { key: "today", label: "Today" },
                  { key: "last-3", label: "Last 3 days" },
                  { key: "over-3", label: "Over 3 days" },
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

              <div className="divide-y divide-border/50 max-h-[190px] overflow-y-auto pr-1">
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
              <button
                onClick={() => navigate("/mates")}
                className="w-full mt-3 text-sm text-muted-foreground flex items-center justify-center gap-1 hover:text-foreground transition-colors py-1"
              >
                See all {mates.length} mates <ChevronRight size={14} />
              </button>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Meet-Ups */}
        <div className="nuj-card p-4">
          <Collapsible
            open={openSections.meetups}
            onOpenChange={(open) => setSectionOpen("meetups", open)}
          >
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between text-left">
                <div className="flex items-center gap-2">
                  <MapPin size={15} className="text-muted-foreground" />
                  <h2 className="font-semibold text-sm tracking-tight">Meet-Ups</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{joinedMeetups.length} joined</span>
                  <ChevronDown
                    size={16}
                    className={`text-muted-foreground transition-transform ${openSections.meetups ? "rotate-180" : ""}`}
                  />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-xs text-muted-foreground mb-2">Joined meet-ups</p>
                {joinedMeetups.length > 0 ? (
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-muted/70 to-transparent rounded-l-xl" />
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-muted/70 to-transparent rounded-r-xl" />
                    <div className="flex gap-2 overflow-x-auto pb-1">
                      {joinedMeetups.map((meetup) => {
                      const participatingMatesData = mates.filter((m) => meetup.participatingMates.includes(m.id));
                      const totalJoined = Math.min(meetup.participantsRequired, participatingMatesData.length + 1);
                      const progress = totalJoined / meetup.participantsRequired;

                      return (
                        <button
                          key={meetup.id}
                          onClick={() => navigate(`/meetup/${meetup.id}`)}
                          className="shrink-0 w-60 text-left p-4 bg-card hover:bg-muted rounded-xl transition-colors"
                        >
                          <p className="font-medium text-sm">{meetup.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{meetup.description}</p>

                          <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-3 mb-2">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${progress * 100}%`,
                                background: "hsl(var(--accent))",
                              }}
                            />
                          </div>

                          <p className="text-xs text-muted-foreground">
                            {totalJoined}/{meetup.participantsRequired} joined
                          </p>

                          <div className="flex -space-x-1.5 mt-3">
                            {participatingMatesData.map((m) => (
                              <MateAvatar key={m.id} initials={m.initials} size="sm" status={m.lastCheckin} daysSinceCheckin={m.daysSinceCheckin} />
                            ))}
                          </div>

                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                            {participatingMatesData.length > 0
                              ? `Also joined: ${participatingMatesData.map((m) => m.name).join(", ")}`
                              : "No mates joined yet"}
                          </p>
                        </button>
                      );
                    })}
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground py-2 px-1">
                    You haven't joined any meet-ups yet.
                  </p>
                )}
              </div>
              <button
                onClick={() => navigate("/meetups")}
                className="w-full mt-3 text-sm text-muted-foreground flex items-center justify-center gap-1 hover:text-foreground transition-colors py-1"
              >
                See all meet-ups <ChevronRight size={14} />
              </button>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <p className="text-center text-xs text-muted-foreground/70 py-2">
          Just a simple way to stay connected
        </p>
      </div>

      <AddMateSheet open={addMateOpen} onClose={() => setAddMateOpen(false)} />
      {selectedNujCard && selectedNujMate && (
        <NujActionSheet
          nuj={selectedNujCard}
          mate={selectedNujMate}
          onClose={() => setSelectedNuj(null)}
          onActionComplete={completeNujAction}
        />
      )}
    </div>
  );
};

export default Dashboard;
