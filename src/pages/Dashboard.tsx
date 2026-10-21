import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, Plus, MapPin, MessageCircle, UserRound, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { TopNav } from "@/components/TopNav";
import { MateRow, MateAvatar } from "@/components/MateComponents";
import { formatNujTimestamp } from "@/data/mockData";
import { AddMateSheet } from "@/components/AddMateSheet";
import { NujActionSheet } from "@/components/NujActionSheet";
import { useCheckin } from "@/hooks/useCheckin";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useMateConnections } from "@/hooks/useMateConnections";
import { MateRequestsPanel } from "@/components/MateRequestsPanel";
import { useNujsSupabase } from "@/hooks/useNujsSupabase";
import {
  DEFAULT_CHECKIN_CADENCE_DAYS,
  isWithinCheckinCadence,
  useGroupsSupabase,
} from "@/hooks/useGroupsSupabase";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { SharedGroupsSection } from "@/components/SharedGroupsSection";
import { useSharedGroupsSupabase } from "@/hooks/useSharedGroupsSupabase";
import { WhatIsNujDialog } from "@/components/WhatIsNujDialog";

type SectionKey = "nuj" | "mates" | "groups" | "meetups";

const getDaysSinceCheckin = (mate: { lastCheckin: "today" | "yesterday" | "few-days"; daysSinceCheckin?: number }) => {
  if (typeof mate.daysSinceCheckin === "number") return mate.daysSinceCheckin;
  if (mate.lastCheckin === "today") return 0;
  if (mate.lastCheckin === "yesterday") return 1;
  return 3;
};

const formatDayLabel = (days: number) => {
  if (days === 0) return "Today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
};

const Dashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const shouldExpandNuj = Boolean((location.state as { expandNuj?: boolean } | null)?.expandNuj);
  const currentUser = useCurrentUser();
  const { checkedIn } = useCheckin(currentUser?.id);
  const connections = useMateConnections();
  const { mates, refresh: refreshMates } = connections;
  const { groups: groupsList, addGroup } = useGroupsSupabase();
  const sharedGroups = useSharedGroupsSupabase();
  const {
    nujsReceived,
    nujsSent,
    acknowledgeReceivedNuj,
    cancelSentNuj,
    markReceivedNujsRead,
  } = useNujsSupabase();
  const [addMateOpen, setAddMateOpen] = useState(false);
  const [selectedNuj, setSelectedNuj] = useState<string | null>(null);

  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [createGroupError, setCreateGroupError] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [groupMateSearch, setGroupMateSearch] = useState("");
  const [newGroupMateIds, setNewGroupMateIds] = useState<string[]>([]);
  const [matesDayRange, setMatesDayRange] = useState<[number, number]>([0, 31]);
  const [openSections, setOpenSections] = useState<
    Record<SectionKey | "nujSent", boolean>
  >({
    nuj: shouldExpandNuj,
    nujSent: false,
    mates: false,
    groups: false,
    meetups: false,
  });

  const sortedMates = [...mates].sort((a, b) => getDaysSinceCheckin(a) - getDaysSinceCheckin(b));

  const filteredMates = sortedMates.filter((mate) => {
    const daysSinceCheckin = getDaysSinceCheckin(mate);
    const [minDays, maxDays] = matesDayRange;
    // The slider's top stop means "31+ days", so older mates are never hidden.
    return daysSinceCheckin >= minDays && (maxDays >= 31 || daysSinceCheckin <= maxDays);
  });

  const setSectionOpen = (section: SectionKey | "nujSent", open: boolean) => {
    setOpenSections((current) => ({ ...current, [section]: open }));
  };

  useEffect(() => {
    if (!openSections.nuj || nujsReceived.length === 0) {
      return;
    }

    void markReceivedNujsRead();
  }, [openSections.nuj, nujsReceived.length, markReceivedNujsRead]);

  const completeNujAction = async (nujId: string) => {
    await acknowledgeReceivedNuj(nujId);
    setSelectedNuj(null);
  };

  const selectedNujCard = nujsReceived.find((nuj) => nuj.id === selectedNuj);
  const selectedNujMate = selectedNujCard
    ? mates.find((mate) => mate.id === selectedNujCard.fromMateId || mate.mateUserId === selectedNujCard.fromMateId)
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

  const setNewGroupMateChecked = (mateId: string, checked: boolean) => {
    setNewGroupMateIds((currentIds) => {
      const alreadySelected = currentIds.includes(mateId);
      if (checked && !alreadySelected) {
        return [...currentIds, mateId];
      }
      if (!checked && alreadySelected) {
        return currentIds.filter((id) => id !== mateId);
      }
      return currentIds;
    });
  };

  const handleCreateGroup = async () => {
    const normalizedName = newGroupName.trim();
    if (!normalizedName || newGroupMateIds.length === 0) return;

    try {
      setCreateGroupError(null);
      setIsCreatingGroup(true);
      await addGroup(normalizedName, newGroupMateIds);

      setNewGroupName("");
      setGroupMateSearch("");
      setNewGroupMateIds([]);
      setIsAddingGroup(false);
      setSectionOpen("groups", true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to create group right now.";
      setCreateGroupError(message);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  return (
    <div className="h-dvh bg-background max-w-md mx-auto flex flex-col overflow-hidden">
      <header className="shrink-0 bg-background" aria-label="App header">
      <div className="px-5 nuj-safe-top-dashboard">
        <div
          className={`nuj-card min-h-[108px] min-[360px]:min-h-[88px] flex items-center p-4 ${checkedIn ? "cursor-pointer bg-emerald-50/60 border-emerald-200/70" : ""}`}
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
          <div className={`w-full flex items-center gap-2.5 ${checkedIn ? "justify-center" : ""}`}>
            <div className="w-8 h-8 shrink-0 rounded-full flex items-center justify-center" style={{ background: "hsl(var(--nuj-amber-light))" }}>
              <span className="text-base">👋</span>
            </div>
            <div className={checkedIn ? "min-w-0 text-center" : "min-w-0 flex-1"}>
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
                className="ml-auto shrink-0 nuj-btn-primary px-3 py-1.5 text-xs"
              >
                Check in
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pt-2 pb-2">
        <span className="font-bold text-[27px] leading-none text-black select-none" style={{ minWidth: 42 }}>
          NUJ
        </span>
        <div className="flex items-center gap-2">
          <TopNav showButtonsOnly />
          <WhatIsNujDialog />

          <Dialog>
            <DialogTrigger asChild>
              <button
                className="w-9 h-9 flex items-center justify-center rounded-full bg-muted text-foreground hover:bg-secondary transition-colors"
                aria-label="Get in touch"
              >
                <MessageCircle size={19} />
              </button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader className="text-center">
                <DialogTitle className="text-center">Get in touch</DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground pt-1 text-center">
                  If you have any questions or would like to share feedback I'd love to hear from you
                </DialogDescription>
              </DialogHeader>
              <p className="text-sm font-medium text-foreground text-center">charlie@nuj.social</p>
              <div className="pt-3 border-t border-border/60 text-xs text-muted-foreground flex items-center justify-center gap-3">
                <Link to="/support" className="underline underline-offset-2">Support</Link>
                <Link to="/privacy" className="underline underline-offset-2">Privacy Policy</Link>
                <Link to="/terms" className="underline underline-offset-2">Terms of Use</Link>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-5 pb-4 space-y-3" aria-label="Dashboard content">
        {/* Side-by-side NUJ boxes */}
        {(nujsReceived.length > 0 || nujsSent.length > 0) && (
          <div className="flex gap-4">
            {/* You have x NUJs box */}
            <div className={`transition-all duration-300 w-1/2 min-w-[120px]`}> 
              <Collapsible
                open={openSections.nuj}
                onOpenChange={(open) => setSectionOpen("nuj", open)}
              >
                <div className="nuj-card border border-border w-full p-0">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between text-left px-4 py-3 hover:bg-muted/40 focus:outline-none">
                      <div className="flex items-center gap-2">
                        <span className="text-sm" aria-hidden="true">👉</span>
                        <h2 className="font-semibold text-sm tracking-tight whitespace-nowrap">
                          {nujsReceived.length === 0
                            ? "No NUJs 👏"
                            : `${nujsReceived.length} ${nujsReceived.length === 1 ? "NUJ" : "NUJs"} to you`}
                        </h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <ChevronDown
                          size={16}
                          className={`text-muted-foreground transition-transform ${openSections.nuj ? "rotate-180" : ""}`}
                        />
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  {openSections.nuj && (
                    <CollapsibleContent className="pt-3 px-4 pb-4">
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {nujsReceived.length > 0 ? nujsReceived.map((nuj) => {
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
                        }) : <span className="text-xs text-muted-foreground">No NUJs</span>}
                      </div>
                    </CollapsibleContent>
                  )}
                </div>
              </Collapsible>
            </div>
            {/* NUJs you've sent box */}
            <div className={`transition-all duration-300 w-1/2 min-w-[120px]`}>
              <Collapsible
                open={openSections.nujSent}
                onOpenChange={(open) => setSectionOpen("nujSent", open)}
              >
                <div className="nuj-card border border-border w-full p-0">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center justify-between text-left px-4 py-3 hover:bg-muted/40 focus:outline-none">
                      <div className="flex items-center gap-2">
                        <span className="text-sm" aria-hidden="true">👈</span>
                        <h2 className="font-semibold text-sm tracking-tight whitespace-nowrap">
                          {nujsSent.length} {nujsSent.length === 1 ? "NUJ" : "NUJs"} sent
                        </h2>
                      </div>
                      <div className="flex items-center gap-2">
                        <ChevronDown
                          size={16}
                          className={`text-muted-foreground transition-transform ${openSections.nujSent ? "rotate-180" : ""}`}
                        />
                      </div>
                    </button>
                  </CollapsibleTrigger>
                  {openSections.nujSent && (
                    <CollapsibleContent className="pt-3 px-4 pb-4">
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {nujsSent.length > 0 ? nujsSent.map((nuj) => {
                          const nujMate = mates.find((mate) => mate.id === nuj.toMateId);
                          return (
                            <div
                              key={nuj.id}
                              className="relative shrink-0 w-32 p-2 bg-muted/40 rounded-xl transition-colors text-left"
                            >
                              <button
                                type="button"
                                aria-label={`Cancel NUJ to ${nuj.toMateName}`}
                                onClick={() => void cancelSentNuj(nuj.id)}
                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/90 border border-border text-muted-foreground hover:text-foreground hover:bg-background flex items-center justify-center"
                              >
                                <X size={12} />
                              </button>
                              <div className="flex items-center gap-1.5">
                                <MateAvatar
                                  initials={nuj.toMateInitials}
                                  size="sm"
                                  status={nujMate?.lastCheckin}
                                  daysSinceCheckin={nujMate?.daysSinceCheckin}
                                />
                                <p className="text-xs font-medium leading-tight line-clamp-2">{nuj.toMateName}</p>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-1">Sent {formatNujTimestamp(nuj.sentAt)}</p>
                            </div>
                          );
                        }) : <span className="text-xs text-muted-foreground">No NUJs sent</span>}
                      </div>
                    </CollapsibleContent>
                  )}
                </div>
              </Collapsible>
            </div>
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
                    <span className="text-xs text-muted-foreground">{groupsList.length + (sharedGroups.data?.length ?? 0)}</span>
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
                  const cadenceDays = group.checkinCadenceDays ?? DEFAULT_CHECKIN_CADENCE_DAYS;
                  const checkedInWithinCadence = groupMates.filter((m) => isWithinCheckinCadence(m, cadenceDays)).length;
                  return (
                    <button
                      key={group.id}
                      title="Personal group"
                      onClick={() => navigate(`/group/${group.id}`)}
                      className="w-full flex items-center gap-3 py-2.5 px-3 bg-muted/40 hover:bg-muted rounded-xl transition-colors text-left"
                    >
                      <div className="flex -space-x-2">
                        {groupMates.slice(0, 3).map((m) => (
                          <MateAvatar key={m.id} initials={m.initials} size="sm" status={m.lastCheckin} daysSinceCheckin={m.daysSinceCheckin} />
                        ))}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium flex items-center gap-1.5"><UserRound size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" /><span className="break-words min-w-0">{group.name}</span><span className="sr-only">Personal group</span></p>
                        <p className="text-xs text-muted-foreground">{checkedInWithinCadence}/{groupMates.length} checked in</p>
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                    </button>
                  );
                })}

                {groupsList.length === 0 && !sharedGroups.data?.length && (
                  <p className="text-xs text-muted-foreground px-1 py-1">
                    No groups yet. Tap "New group" below to create one.
                  </p>
                )}
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
                    {filteredMatesForNewGroup.length > 0 ? (
                      filteredMatesForNewGroup.map((mate) => (
                        <button
                          type="button"
                          key={mate.id}
                          onClick={() => toggleNewGroupMate(mate.id)}
                          className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors cursor-pointer"
                        >
                          <Checkbox
                            checked={newGroupMateIds.includes(mate.id)}
                            aria-label={`Select ${mate.name}`}
                            onClick={(event) => event.stopPropagation()}
                            onCheckedChange={(checked) => setNewGroupMateChecked(mate.id, checked === true)}
                          />
                          <MateAvatar initials={mate.initials} size="sm" status={mate.lastCheckin} daysSinceCheckin={mate.daysSinceCheckin} />
                          <span className="text-sm font-medium">{mate.name}</span>
                        </button>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground px-1 py-2">
                        {mates.length === 0 ? "Add a mate first to create a group." : "No mates match your search."}
                      </p>
                    )}
                  </div>

                  {createGroupError && (
                    <p className="text-xs text-destructive">{createGroupError}</p>
                  )}

                  <button
                    onClick={handleCreateGroup}
                    disabled={isCreatingGroup || !newGroupName.trim() || newGroupMateIds.length === 0}
                    className="w-full nuj-btn-primary h-10 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isCreatingGroup ? "Creating..." : "Done"}
                  </button>
                </div>
              )}

              <div className="flex justify-end mt-3">
                <button
                  onClick={() => {
                    setSectionOpen("groups", true);
                    setCreateGroupError(null);
                    setIsAddingGroup((current) => !current);
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <Plus size={13} />
                  {isAddingGroup ? "Cancel" : "New personal group"}
                </button>
              </div>
              <SharedGroupsSection groups={sharedGroups.data ?? []} loading={sharedGroups.isLoading}
                error={sharedGroups.error} refresh={sharedGroups.refetch} />
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
                  <ChevronDown
                    size={16}
                    className={`text-muted-foreground transition-transform ${openSections.mates ? "rotate-180" : ""}`}
                  />
                </div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setAddMateOpen(true)}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                >
                  <Plus size={13} />
                  Add mate
                </button>
              </div>

              <MateRequestsPanel connections={connections} />

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
                See all mates <ChevronRight size={14} />
              </button>

              <div className="mt-3">
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
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Meet-Ups */}
        <div className="nuj-card p-4 grayscale opacity-70">
          <Collapsible
            open={openSections.meetups}
            onOpenChange={(open) => setSectionOpen("meetups", open)}
          >
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between text-left">
                <div className="flex items-center gap-2">
                  <MapPin size={15} className="text-muted-foreground" />
                  <h2 className="font-semibold text-sm tracking-tight">Meet-ups (coming soon..)</h2>
                </div>
                <ChevronDown
                  size={16}
                  className={`text-muted-foreground transition-transform ${openSections.meetups ? "rotate-180" : ""}`}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-3">
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-sm text-muted-foreground">
                  Sign-up and check-in with mates to unlock deals for real-world activities.
                </p>
                <p className="text-sm text-muted-foreground mt-3">
                  A chance to catch up and spend time together.
                </p>
                <p className="text-sm text-muted-foreground text-center mt-3">
                  win-win
                </p>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

      </main>

      <footer className="shrink-0 bg-background px-5 pt-3 pb-[calc(var(--nuj-safe-bottom)+0.75rem)]" aria-label="App footer">
        <p className="text-center text-xs text-black">Stay connected</p>
      </footer>

      <AddMateSheet open={addMateOpen} onClose={() => setAddMateOpen(false)} onMateAdded={() => void refreshMates()} />
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
