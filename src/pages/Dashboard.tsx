import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, Plus, MapPin } from "lucide-react";
import { TopNav } from "@/components/TopNav";
import { MateRow, MateAvatar } from "@/components/MateComponents";
import { mates, groups, nujsReceived, meetUps, saveGroupsToStorage } from "@/data/mockData";
import { AddMateSheet } from "@/components/AddMateSheet";
import { NujActionSheet } from "@/components/NujActionSheet";
import { useCheckin } from "@/hooks/useCheckin";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

type SectionKey = "nuj" | "mates" | "groups" | "meetups";

const Dashboard = () => {
  const navigate = useNavigate();
  const { checkedIn } = useCheckin();
  const [addMateOpen, setAddMateOpen] = useState(false);
  const [selectedNuj, setSelectedNuj] = useState<string | null>(null);
  const [nujCards, setNujCards] = useState(nujsReceived);
  const [groupsList, setGroupsList] = useState(groups);
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [groupMateSearch, setGroupMateSearch] = useState("");
  const [newGroupMateIds, setNewGroupMateIds] = useState<string[]>([]);
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    nuj: false,
    mates: false,
    groups: false,
    meetups: false,
  });

  const sortedMates = [...mates].sort((a, b) => {
    const order = { today: 0, yesterday: 1, "few-days": 2 };
    return order[a.lastCheckin] - order[b.lastCheckin];
  });

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
      <TopNav onAddMate={() => setAddMateOpen(true)} />

      <div className="px-5 pb-24 space-y-4">
        {/* Checked-In Card */}
        <div className="nuj-card p-5">
          <div className={`flex items-center gap-3 ${checkedIn ? "justify-center" : ""}`}>
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "hsl(var(--nuj-amber-light))" }}>
              <span className="text-lg">👋</span>
            </div>
            <div className={checkedIn ? "text-center" : ""}>
              <p className="font-semibold text-foreground">
                {checkedIn ? "You are here today" : "Not checked in yet"}
              </p>
              {!checkedIn && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tap to check in and see who's around
                </p>
              )}
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
                    <h2 className="font-semibold text-sm tracking-tight">You've been NUJ'd</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{nujCards.length}</span>
                    <ChevronDown
                      size={16}
                      className={`text-muted-foreground transition-transform ${openSections.nuj ? "rotate-180" : ""}`}
                    />
                  </div>
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3">
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {nujCards.map((nuj) => (
                    <button
                      key={nuj.id}
                      onClick={() => setSelectedNuj(nuj.id)}
                      className="shrink-0 w-40 p-3 bg-muted/40 hover:bg-muted rounded-xl transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        <MateAvatar initials={nuj.fromMateInitials} size="sm" />
                        <p className="text-sm font-medium">{nuj.fromMateName}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">{nuj.time}</p>
                    </button>
                  ))}
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
                  <span className="text-xs text-muted-foreground">{groupsList.length}</span>
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
                        <MateAvatar initials={mate.initials} size="sm" status={mate.lastCheckin} />
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

        {/* Your Mates */}
        <div className="nuj-card p-4">
          <Collapsible
            open={openSections.mates}
            onOpenChange={(open) => setSectionOpen("mates", open)}
          >
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm" aria-hidden="true">👤︎</span>
                  <h2 className="font-semibold text-sm tracking-tight">Your Mates</h2>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{mates.length}</span>
                  <ChevronDown
                    size={16}
                    className={`text-muted-foreground transition-transform ${openSections.mates ? "rotate-180" : ""}`}
                  />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="divide-y divide-border/50 max-h-[190px] overflow-y-auto pr-1">
                {sortedMates.map((mate) => (
                  <MateRow
                    key={mate.id}
                    mate={mate}
                    onClick={() => navigate(`/mate/${mate.id}`)}
                  />
                ))}
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
                <ChevronDown
                  size={16}
                  className={`text-muted-foreground transition-transform ${openSections.meetups ? "rotate-180" : ""}`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
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
              <button
                onClick={() => navigate("/meetups")}
                className="w-full mt-3 text-sm text-muted-foreground flex items-center justify-center gap-1 hover:text-foreground transition-colors py-1"
              >
                See all meet-ups <ChevronRight size={14} />
              </button>
            </CollapsibleContent>
          </Collapsible>
        </div>
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
