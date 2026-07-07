import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, X } from "lucide-react";
import { MateAvatar, MateRow } from "@/components/MateComponents";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { useMatesSupabase } from "@/hooks/useMatesSupabase";
import { useGroupsSupabase } from "@/hooks/useGroupsSupabase";

const getDaysSinceCheckin = (mate: { lastCheckin: "today" | "yesterday" | "few-days"; daysSinceCheckin?: number }) => {
  if (typeof mate.daysSinceCheckin === "number") return mate.daysSinceCheckin;
  if (mate.lastCheckin === "today") return 0;
  if (mate.lastCheckin === "yesterday") return 1;
  return 3;
};

const GroupDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { mates } = useMatesSupabase();
  const { groups, updateGroup, removeGroup } = useGroupsSupabase();
  const group = groups.find((g) => g.id === id);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupName, setGroupName] = useState(group?.name ?? "");
  const [groupMateIds, setGroupMateIds] = useState<string[]>(group?.mates ?? []);
  const [matesDayRange, setMatesDayRange] = useState<[number, number]>([0, 31]);

  useEffect(() => {
    if (!group) return;
    setGroupName(group.name);
    setGroupMateIds(group.mates);
  }, [group]);

  const groupMates = useMemo(
    () => mates.filter((mate) => groupMateIds.includes(mate.id)),
    [groupMateIds, mates],
  );

  const filteredGroupMates = useMemo(() => {
    const [minDays, maxDays] = matesDayRange;
    return groupMates.filter((mate) => {
      const daysSinceCheckin = getDaysSinceCheckin(mate);
      return daysSinceCheckin >= minDays && daysSinceCheckin <= maxDays;
    });
  }, [groupMates, matesDayRange]);

  const filteredAvailableMates = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return mates.filter((mate) => {
      const isAlreadyInGroup = groupMateIds.includes(mate.id);
      if (isAlreadyInGroup) return false;
      if (!query) return true;

      return mate.name.toLowerCase().includes(query);
    });
  }, [groupMateIds, searchQuery]);

  const removeMateFromGroup = (mateId: string) => {
    setGroupMateIds((currentIds) => currentIds.filter((id) => id !== mateId));
  };

  const addMateToGroup = (mateId: string) => {
    setGroupMateIds((currentIds) => {
      if (currentIds.includes(mateId)) return currentIds;
      return [...currentIds, mateId];
    });
  };

  const persistGroupEdits = async () => {
    if (!group) return;

    const normalizedName = groupName.trim();
    const nextGroupName = normalizedName || group.name;

    await updateGroup(group.id, {
      name: nextGroupName,
      mateIds: groupMateIds,
    });
    setGroupName(nextGroupName);
  };

  const deleteGroup = async () => {
    if (!group) return;

    const confirmed = window.confirm(`Delete ${group.name}?`);
    if (!confirmed) return;

    await removeGroup(group.id);
    navigate("/dashboard");
  };

  if (!group) return null;

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      <div className="px-5 pb-6 nuj-safe-top-section">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back</span>
        </button>
        <div className="flex items-center justify-between gap-3">
          {isEditing ? (
            <Input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Group name"
              aria-label="Edit group name"
              className="h-9 text-lg font-semibold"
            />
          ) : (
            <h1 className="text-2xl font-bold tracking-tight">{groupName}</h1>
          )}
          <button
            onClick={async () => {
              if (isEditing) {
                await persistGroupEdits();
              }
              setIsEditing((editing) => !editing);
              setSearchQuery("");
            }}
            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {isEditing ? "Done" : "Edit"}
          </button>
        </div>
        <p className="text-muted-foreground text-sm mt-1">{groupMates.length} mates</p>
      </div>

      <div className="px-5 nuj-safe-bottom-page">
        <div className="nuj-card p-4">
          {filteredGroupMates.map((mate) => (
            <div key={mate.id} className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <MateRow
                  mate={mate}
                  onClick={() => navigate(`/mate/${mate.id}`)}
                  showGroup={false}
                />
              </div>
              {isEditing && (
                <button
                  onClick={() => removeMateFromGroup(mate.id)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label={`Remove ${mate.name} from group`}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          ))}

          {filteredGroupMates.length === 0 && (
            <p className="text-xs text-muted-foreground py-3 px-1">No mates for this filter.</p>
          )}

          <div className="mt-3">
            <div className="flex justify-start mb-2">
              <span className="text-xs text-muted-foreground">
                Showing {filteredGroupMates.length} of {groupMates.length} mates
                {matesDayRange[0] === 0 && matesDayRange[1] === 31
                  ? ""
                  : ` with last check-in ${matesDayRange[0]}-${matesDayRange[1]} days ago`}
              </span>
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

          {isEditing && (
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-sm font-medium mb-3">Add mates</p>
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search your mates"
                aria-label="Search mates to add"
              />

              <div className="mt-3 space-y-1 max-h-56 overflow-y-auto">
                {filteredAvailableMates.length === 0 ? (
                  <p className="text-sm text-muted-foreground px-1 py-2">
                    No mates found to add.
                  </p>
                ) : (
                  filteredAvailableMates.map((mate) => (
                    <button
                      key={mate.id}
                      onClick={() => addMateToGroup(mate.id)}
                      className="w-full flex items-center gap-3 py-2 px-1 rounded-xl hover:bg-muted/50 transition-colors text-left"
                    >
                      <MateAvatar initials={mate.initials} status={mate.lastCheckin} daysSinceCheckin={mate.daysSinceCheckin} />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{mate.name}</p>
                      </div>
                      <span className="text-muted-foreground">
                        <Plus size={16} />
                      </span>
                    </button>
                  ))
                )}
              </div>

              <button
                onClick={deleteGroup}
                className="mt-4 text-sm font-medium text-destructive hover:text-destructive/80 transition-colors"
              >
                Delete group
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupDetail;
