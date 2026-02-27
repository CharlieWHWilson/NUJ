import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, X } from "lucide-react";
import { mates, groups, saveGroupsToStorage } from "@/data/mockData";
import { MateAvatar, MateRow } from "@/components/MateComponents";
import { useParams } from "react-router-dom";
import { Input } from "@/components/ui/input";

const GroupDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const group = groups.find((g) => g.id === id);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [groupName, setGroupName] = useState(group?.name ?? "");
  const [groupMateIds, setGroupMateIds] = useState<string[]>(group?.mates ?? []);

  useEffect(() => {
    if (!group) return;
    setGroupName(group.name);
    setGroupMateIds(group.mates);
  }, [group]);

  const groupMates = useMemo(
    () => mates.filter((mate) => groupMateIds.includes(mate.id)),
    [groupMateIds],
  );

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

  const persistGroupEdits = () => {
    if (!group) return;

    const normalizedName = groupName.trim();
    const nextGroupName = normalizedName || group.name;

    group.name = nextGroupName;
    group.mates = groupMateIds;
    saveGroupsToStorage(groups);
    setGroupName(nextGroupName);
  };

  if (!group) return null;

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
            onClick={() => {
              if (isEditing) {
                persistGroupEdits();
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

      <div className="px-5 pb-16">
        <div className="nuj-card p-4">
          {groupMates.map((mate) => (
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
                      <MateAvatar initials={mate.initials} status={mate.lastCheckin} />
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupDetail;
