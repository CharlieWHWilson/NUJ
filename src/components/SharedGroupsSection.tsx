import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Link, Plus, UsersRound } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { CHECKIN_CADENCE_OPTIONS, DEFAULT_CHECKIN_CADENCE_DAYS, formatCheckinCadence } from "@/hooks/useGroupsSupabase";
import { createSharedGroup, parseGroupInvite, type SharedGroup } from "@/lib/sharedGroups";

type Props = {
  groups: SharedGroup[];
  loading: boolean;
  error: Error | null;
  refresh: () => unknown;
};

export const SharedGroupsSection = ({ groups, loading, error, refresh }: Props) => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"create" | "join" | null>(null);
  const [name, setName] = useState("");
  const [cadence, setCadence] = useState(1);
  const [invite, setInvite] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const open = (next: "create" | "join") => {
    setMessage(null);
    setMode(next);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (mode === "join") {
      const code = parseGroupInvite(invite);
      if (!code) {
        setMessage("Enter a valid group invite link or code.");
        return;
      }
      navigate(`/join/${code}`);
      return;
    }
    setBusy(true);
    try {
      const id = await createSharedGroup(name.trim(), cadence);
      void refresh();
      navigate(`/shared-group/${id}`);
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : "Unable to create this group.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-3">
      {loading && <p role="status" className="text-xs text-muted-foreground">Loading shared groups...</p>}
      {error && <div className="text-xs text-destructive" role="alert">
        {error.message}
        <button onClick={() => void refresh()} className="ml-2 underline">Retry</button>
      </div>}
      {groups.map((group) => (
        <button key={group.id} title="Shared group" onClick={() => navigate(`/shared-group/${group.id}`)}
          className="w-full flex items-center gap-3 py-2.5 px-3 bg-muted/40 hover:bg-muted rounded-lg text-left">
          <UsersRound size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium break-words">{group.name}<span className="sr-only">, Shared group</span></p>
            <p className="text-xs text-muted-foreground">{group.members.filter((member) => member.checkedIn).length}/{group.members.length} checked in</p>
          </div>
          <ChevronRight size={14} className="shrink-0 text-muted-foreground" />
        </button>
      ))}
      <div className="flex flex-wrap justify-end gap-x-4 gap-y-3">
        <button onClick={() => open("join")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Link size={14} /> Join group
        </button>
        <button onClick={() => open("create")} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <Plus size={13} /><UsersRound size={14} /> Shared group
        </button>
      </div>
      <Dialog open={mode !== null} onOpenChange={(value) => { if (!value && !busy) setMode(null); }}>
        <DialogContent className="max-w-sm rounded-lg">
          <DialogHeader>
            <DialogTitle>{mode === "join" ? "Join a shared group" : "Create a shared group"}</DialogTitle>
            <DialogDescription>Members can see names and whether each person has checked in within the group's cadence. Joining does not add individual mates.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(event) => void submit(event)} className="space-y-4">
            {mode === "join" ? (
              <label className="block text-sm">Group invite link or code
                <Input value={invite} onChange={(event) => setInvite(event.target.value)} required className="mt-2" autoCapitalize="none" />
              </label>
            ) : <>
              <label className="block text-sm">Group name
                <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required className="mt-2" />
              </label>
              <div>
                <div className="flex items-center justify-between gap-3 mb-2">
                  <p className="text-sm font-medium">Check-in cadence</p>
                  <span className="text-xs text-muted-foreground">{formatCheckinCadence(cadence)}</span>
                </div>
                <Slider value={[Math.max(0, CHECKIN_CADENCE_OPTIONS.indexOf(cadence))]}
                  min={0} max={CHECKIN_CADENCE_OPTIONS.length - 1} step={1} disabled={busy}
                  aria-label="Check-in cadence"
                  onValueChange={(value) => setCadence(CHECKIN_CADENCE_OPTIONS[value[0] ?? 0] ?? DEFAULT_CHECKIN_CADENCE_DAYS)} />
              </div>
            </>}
            {message && <p role="alert" className="text-sm text-destructive">{message}</p>}
            <button type="submit" disabled={busy || (mode === "create" && !name.trim())} className="w-full nuj-btn-primary h-11 disabled:opacity-50">
              {busy ? "Creating..." : mode === "join" ? "Preview group" : "Create shared group"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};