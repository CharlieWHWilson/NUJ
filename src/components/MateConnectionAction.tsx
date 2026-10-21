import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronDown, UserRoundPlus, X } from "lucide-react";
import type { MateConnections } from "@/hooks/useMateConnections";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

type Props = { userId: string; name: string; connections: MateConnections; onConnected?: () => void };

export const MateConnectionAction = ({ userId, name, connections, onConnected }: Props) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  if (!connections.userId || userId === connections.userId) return null;
  const mate = connections.mates.find((candidate) => candidate.mateUserId === userId);
  const incoming = connections.incoming.find((request) => request.userId === userId);
  const outgoing = connections.outgoing.find((request) => request.userId === userId);
  const disabled = busy || connections.loading || Boolean(connections.error);

  const act = async (action: "send" | "accept" | "decline" | "cancel") => {
    if (disabled) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (action === "send") {
        const result = await connections.send(userId);
        setNotice(result.status === "pending" ? "Request sent." : result.status === "incoming" ? "You have a request from this person." : "Already mates.");
      } else {
        const request = action === "cancel" ? outgoing : incoming;
        if (!request) return;
        await connections.respond(request.id, action);
        if (action === "accept") {
          setNotice(`You and ${name} are now mates.`);
          onConnected?.();
        }
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to update this request.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="min-w-0 max-w-full">
    {mate ? <Link to={`/mate/${mate.id}`} className="inline-flex items-center gap-1 text-xs text-muted-foreground" title={`View ${name}`}><Check size={14} />Mate</Link>
      : incoming ? <div className="flex items-center gap-1">
        <button disabled={disabled} onClick={() => void act("accept")} className="px-2 py-2 text-xs font-medium disabled:opacity-50" aria-label={`Accept ${name}'s mate request`}>Accept</button>
        <button disabled={disabled} onClick={() => void act("decline")} className="p-2 text-muted-foreground" title={`Decline ${name}'s request`} aria-label={`Decline ${name}'s mate request`}><X size={14} /></button>
      </div>
      : outgoing ? <DropdownMenu>
        <DropdownMenuTrigger asChild><button disabled={disabled} className="flex items-center gap-1 py-2 text-xs text-muted-foreground" aria-label={`Request to ${name} pending`}>Requested<ChevronDown size={12} /></button></DropdownMenuTrigger>
        <DropdownMenuContent align="end"><DropdownMenuItem disabled={disabled} onSelect={() => void act("cancel")}>Cancel request</DropdownMenuItem></DropdownMenuContent>
      </DropdownMenu>
      : <button disabled={disabled} onClick={() => void act("send")} className="inline-flex items-center gap-1.5 py-2 text-xs font-medium disabled:opacity-50" aria-label={`Add ${name} as a mate`}><UserRoundPlus size={15} />{busy ? "Sending..." : "Add mate"}</button>}
    {error && <p role="alert" className="mt-1 max-w-40 text-xs text-destructive break-words">{error}</p>}
    {notice && <p role="status" className="sr-only">{notice}</p>}
  </div>;
};