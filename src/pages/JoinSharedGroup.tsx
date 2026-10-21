import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, UsersRound } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatCheckinCadence } from "@/hooks/useGroupsSupabase";
import { APP_STORE_URL } from "@/lib/mateInvite";
import { joinSharedGroup, normalizeGroupInvite, previewSharedGroup, savePendingGroupInvite, type GroupPreview } from "@/lib/sharedGroups";

const JoinSharedGroup = ({ authenticated }: { authenticated: boolean }) => {
  const { code: rawCode } = useParams();
  const code = normalizeGroupInvite(rawCode);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<GroupPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setPreview(null);
    if (!code) {
      setError("This group invite isn't valid.");
      setLoading(false);
      return;
    }
    void previewSharedGroup(code).then((result) => {
      if (!active) return;
      setPreview(result);
      if (!result) setError("This invite is no longer valid. Ask the owner for a new link.");
    }).catch((failure) => {
      if (active) setError(failure instanceof Error ? failure.message : "Unable to load this invite.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [code, attempt]);

  const join = async () => {
    if (!code || busy) return;
    if (!authenticated) {
      savePendingGroupInvite(code);
      navigate("/auth");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = await joinSharedGroup(code);
      await queryClient.invalidateQueries({ queryKey: ["shared-groups"] });
      navigate(`/shared-group/${id}`, { replace: true });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Unable to join this group.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="min-h-screen bg-background max-w-md mx-auto px-5 nuj-safe-top-section nuj-safe-bottom-page">
    <Link to={authenticated ? "/dashboard" : "/auth"} className="mb-8 flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft size={18} />Back</Link>
    {loading && <p role="status">Loading group invite...</p>}
    {preview && <>
      <p className="flex items-center gap-2 text-sm text-muted-foreground"><UsersRound size={16} />Shared group</p>
      <h1 className="mt-2 text-2xl font-bold break-words">{preview.name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Owner: {preview.ownerName}</p>
      <p className="mt-1 text-sm text-muted-foreground">{preview.memberCount} members · {formatCheckinCadence(preview.cadenceDays)}</p>
      <p className="mt-6 text-sm">Members can see your name and whether you've checked in within this group's cadence. Your check-in history stays private. Joining does not add individual mates.</p>
      <button onClick={() => void join()} disabled={busy} className="mt-6 w-full nuj-btn-primary h-12 disabled:opacity-50">
        {busy ? "Joining..." : authenticated ? "Join group" : "Sign in or sign up to join"}
      </button>
      {!authenticated && <div className="mt-5 space-y-3 text-sm">
        <a href={APP_STORE_URL} className="underline">Get NUJ for iPhone</a>
        <p className="text-muted-foreground">After installing, reopen this invite link or enter this group invite code:</p>
        <p className="break-all select-all font-mono text-xs">{code}</p>
      </div>}
    </>}
    {error && <div className="mt-4" role="alert"><p className="text-sm text-destructive">{error}</p>
      {!preview && <button onClick={() => setAttempt((value) => value + 1)} className="mt-3 text-sm underline">Retry</button>}
    </div>}
  </div>;
};

export default JoinSharedGroup;