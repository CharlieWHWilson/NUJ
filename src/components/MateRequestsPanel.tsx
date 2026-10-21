import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import type { MateConnections } from "@/hooks/useMateConnections";
import { dismissPreviousMate } from "@/lib/mateRequests";
import { MateConnectionAction } from "./MateConnectionAction";

export const MateRequestsPanel = ({ connections }: { connections: MateConnections }) => {
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const respond = async (id: string, action: "accept" | "decline" | "cancel" | "dismiss") => {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      if (action === "dismiss") await dismissPreviousMate(id);
      else await connections.respond(id, action);
      await connections.refresh();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to update this request.");
    } finally {
      setBusyId(null);
    }
  };

  return <>
    {connections.error && <div role="alert" className="mb-4 text-xs text-destructive">{connections.error}<button className="ml-2 underline" onClick={() => void connections.refresh()}>Retry</button></div>}
    {error && <p role="alert" className="mb-3 text-xs text-destructive">{error}</p>}
    {(connections.incoming.length > 0 || connections.outgoing.length > 0) && <section aria-label="Mate requests" className="mb-6 border-b border-border pb-4">
      <h2 className="text-sm font-semibold mb-2">Mate requests</h2>
      {connections.incoming.map((request) => <div key={request.id} className="flex items-center gap-3 py-2">
        <span className="flex-1 min-w-0 text-sm break-words">{request.name}</span>
        <button disabled={Boolean(busyId)} onClick={() => void respond(request.id, "accept")} className="flex items-center gap-1 text-xs font-medium disabled:opacity-50" aria-label={`Accept ${request.name}'s mate request`}><Check size={15} />Accept</button>
        <button disabled={Boolean(busyId)} onClick={() => void respond(request.id, "decline")} className="p-2 text-muted-foreground" aria-label={`Decline ${request.name}'s mate request`} title="Decline request"><X size={15} /></button>
      </div>)}
      {connections.outgoing.map((request) => <div key={request.id} className="flex items-center gap-3 py-2">
        <span className="flex-1 min-w-0 text-sm break-words">{request.name}<span className="ml-2 text-xs text-muted-foreground">Requested</span></span>
        <button disabled={Boolean(busyId)} onClick={() => void respond(request.id, "cancel")} className="text-xs text-muted-foreground">Cancel</button>
      </div>)}
    </section>}
    {connections.previous.length > 0 && <details className="mb-5 border-b border-border pb-3">
      <summary className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground"><ChevronDown size={14} />Previous additions</summary>
      <p className="mt-3 text-xs text-muted-foreground">These earlier additions weren't mutual connections. No requests were sent automatically. Check-in details stay private until a request is accepted.</p>
      {connections.previous.map((person) => <div key={person.id} className="flex items-center gap-3 py-3">
        <span className="min-w-0 flex-1 text-sm break-words">{person.name}</span>
        {person.userId && <MateConnectionAction userId={person.userId} name={person.name} connections={connections} />}
        <button disabled={Boolean(busyId)} onClick={() => void respond(person.id, "dismiss")} className="p-2 text-muted-foreground" title="Dismiss previous addition" aria-label={`Dismiss previous addition for ${person.name}`}><X size={14} /></button>
      </div>)}
    </details>}
  </>;
};