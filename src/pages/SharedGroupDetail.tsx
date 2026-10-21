import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Copy, Crown, Ellipsis, LogOut, Pencil, RefreshCw, Share2, Trash2, UsersRound, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { MateAvatar } from "@/components/MateComponents";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { CHECKIN_CADENCE_OPTIONS, DEFAULT_CHECKIN_CADENCE_DAYS, formatCheckinCadence } from "@/hooks/useGroupsSupabase";
import { useSharedGroupsSupabase } from "@/hooks/useSharedGroupsSupabase";
import { buildMateInitials } from "@/lib/supabaseData";
import { buildGroupInviteLink, buildGroupInviteMessage, manageSharedGroup, type SharedGroupAction } from "@/lib/sharedGroups";
import { useMateConnections } from "@/hooks/useMateConnections";
import { MateConnectionAction } from "@/components/MateConnectionAction";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const SharedGroupDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const query = useSharedGroupsSupabase();
  const connections = useMateConnections();
  const group = query.data?.find((candidate) => candidate.id === id);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [cadence, setCadence] = useState(1);

  const perform = async (action: SharedGroupAction, options?: Parameters<typeof manageSharedGroup>[2]) => {
    if (!group || busy) return false;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await manageSharedGroup(group.id, action, options);
      await queryClient.invalidateQueries({ queryKey: ["shared-groups"] });
      if (action === "leave" || action === "delete") navigate("/dashboard", { replace: true });
      if (action === "reset_invite") setNotice("Invite reset. The old link no longer works.");
      return true;
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to update this group.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const share = async (copyOnly = false) => {
    if (!group?.inviteCode || busy) return;
    setError(null);
    setNotice(null);
    try {
      if (!copyOnly && navigator.share) {
        await navigator.share({ title: group.name, text: buildGroupInviteMessage(group.name, group.inviteCode) });
      } else {
        await navigator.clipboard.writeText(copyOnly ? buildGroupInviteLink(group.inviteCode) : buildGroupInviteMessage(group.name, group.inviteCode));
        setNotice(copyOnly ? "Invite link copied." : "Invitation copied. Paste it into your group chat.");
      }
    } catch (failure) {
      if (failure instanceof Error && failure.name === "AbortError") return;
      setError("Couldn't share automatically. Select and copy the invite link below.");
    }
  };

  return <div className="min-h-screen bg-background max-w-md mx-auto px-5 nuj-safe-top-section nuj-safe-bottom-page">
    <Link to="/dashboard" className="mb-8 flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18} />Back</Link>
    {query.isPending && <p role="status">Loading shared group...</p>}
    {query.error && <div role="alert"><p className="text-sm text-destructive">{query.error.message}</p><button className="mt-3 text-sm underline" onClick={() => void query.refetch()}>Retry</button></div>}
    {!query.isPending && !query.error && !group && <p className="text-sm text-muted-foreground">This group is unavailable, or you're no longer a member.</p>}
    {group && <>
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex-1 min-w-0 text-2xl font-bold break-words">{group.name}</h1>
        {group.isOwner && <button disabled={busy} title="Edit group" aria-label="Edit group" className="p-2 text-muted-foreground" onClick={() => { setName(group.name); setCadence(group.cadenceDays); setEditing(true); }}><Pencil size={18} /></button>}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><UsersRound size={14} />Shared group</span>
        <span aria-hidden="true">·</span>
        <span className="min-w-0 break-words">{group.isOwner ? "Owned by you" : `Owner: ${group.ownerName}`}</span>
      </div>
      <p className="mt-3 text-sm">{formatCheckinCadence(group.cadenceDays)} · {group.members.filter((member) => member.checkedIn).length}/{group.members.length} checked in</p>

      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="mt-4 text-sm text-muted-foreground">{notice}</p>}
      {connections.error && <div role="alert" className="mt-4 text-xs text-destructive">{connections.error}<button onClick={() => void connections.refresh()} className="ml-2 underline">Retry</button></div>}

      <section className="mt-6 border-t border-border pt-4" aria-label="Group members">
        <div className="nuj-card p-4">
          <h2 className="text-sm font-semibold mb-2">Members · {group.members.length}</h2>
          <div className="divide-y divide-border/50">
            {group.members.map((member) => <div key={member.id} className="flex items-center gap-3 py-3">
              <MateAvatar initials={buildMateInitials(member.name)} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium break-words">{connections.mates.some((mate) => mate.mateUserId === member.id)
                  ? <Link to={`/mate/${connections.mates.find((mate) => mate.mateUserId === member.id)?.id}`}>{member.name}</Link>
                  : member.name}{member.id === group.ownerId && <span className="ml-2 text-xs text-muted-foreground">Owner</span>}</p>
                <p className="text-xs text-muted-foreground">{member.checkedIn ? "Checked in" : "Not checked in within cadence"}</p>
              </div>
              <div className="flex max-w-[45%] shrink-0 items-center gap-1">
                <MateConnectionAction userId={member.id} name={member.name} connections={connections} />
                {group.isOwner && member.id !== group.ownerId && <DropdownMenu>
                  <DropdownMenuTrigger asChild><button disabled={busy} className="p-2 text-muted-foreground" title={`Options for ${member.name}`} aria-label={`Options for ${member.name}`}><Ellipsis size={16} /></button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => { if (window.confirm(`Transfer ownership to ${member.name}? You will no longer manage this group.`)) void perform("transfer", { memberId: member.id }); }}><Crown size={14} className="mr-2" />Make {member.name} owner</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onSelect={() => { if (window.confirm(`Remove ${member.name}? They won't be able to rejoin this group.`)) void perform("remove_member", { memberId: member.id }); }}><X size={14} className="mr-2" />Remove {member.name}</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>}
              </div>
            </div>)}
          </div>
        </div>
      </section>

      {group.isOwner && group.inviteCode && <section className="mt-6 border-t border-border pt-4" aria-label="Group invitation">
        <h2 className="text-sm font-semibold">Invite</h2>
        <div className="mt-3 space-y-2 text-sm text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <div className="flex min-w-0 items-center gap-1">
              <p className="min-w-0 break-all select-all">Group code: {group.inviteCode}</p>
              <button disabled={busy} onClick={() => void share(true)} className="shrink-0 p-1" aria-label="Copy link"><Copy size={16} /></button>
            </div>
            <button disabled={busy} onClick={() => { if (window.confirm("Reset the invite? Previously shared links and codes will stop working.")) void perform("reset_invite"); }} className="flex shrink-0 items-center gap-2" aria-label="Reset invite link" title="Reset invite link"><RefreshCw size={14} />Reset</button>
          </div>
          <button disabled={busy} onClick={() => void share()} className="flex items-center gap-2"><Share2 size={16} />Share invite</button>
        </div>
      </section>}

      <footer className="mt-8 border-t border-border pt-4" aria-label="Group information">
        <p className="mb-4 text-xs text-muted-foreground">
          Members can see names and check-in status. Group membership does not add individual mates.
          {group.isOwner && " To leave, transfer ownership to another member first, or delete the group."}
        </p>
        {group.isOwner ?
          <button disabled={busy} onClick={() => { if (window.confirm(`Delete ${group.name} for everyone?`)) void perform("delete"); }} className="flex items-center gap-2 text-sm text-destructive"><Trash2 size={16} />Delete group</button>
        : <button disabled={busy} onClick={() => { if (window.confirm(`Leave ${group.name}?`)) void perform("leave"); }} className="flex items-center gap-2 text-sm text-destructive"><LogOut size={16} />Leave group</button>}
      </footer>
      <Dialog open={editing} onOpenChange={(value) => { if (!busy) setEditing(value); }}>
        <DialogContent className="max-w-sm rounded-lg">
          <DialogHeader><DialogTitle>Edit shared group</DialogTitle><DialogDescription>Changes apply to everyone in the group.</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={async (event) => {
            event.preventDefault();
            if (await perform("update", { name: name.trim(), cadenceDays: cadence })) setEditing(false);
          }}>
            <label className="block text-sm">Group name<Input className="mt-2" value={name} onChange={(event) => setName(event.target.value)} required maxLength={80} /></label>
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
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <button disabled={busy || !name.trim()} className="w-full nuj-btn-primary h-11 disabled:opacity-50">{busy ? "Saving..." : "Save changes"}</button>
          </form>
        </DialogContent>
      </Dialog>
    </>}
  </div>;
};

export default SharedGroupDetail;