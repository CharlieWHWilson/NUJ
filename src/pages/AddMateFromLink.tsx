import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { MateAvatar } from "@/components/MateComponents";
import { supabase } from "@/lib/supabase";
import {
  addCurrentUserMate,
  buildMateInitials,
  getCurrentUserId,
  searchProfileById,
} from "@/lib/supabaseData";
import { normalizeInviteCode } from "@/lib/mateInvite";
import { toast } from "@/components/ui/sonner";

type InviteProfile = { id: string; name: string; userCode: string };

type LookupState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "self" }
  | { status: "ready"; profile: InviteProfile; existingMateId: string | null };

const AddMateFromLink = () => {
  const { code } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState<LookupState>({ status: "loading" });
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const lookup = async () => {
      const normalizedCode = normalizeInviteCode(code);
      if (!normalizedCode) {
        setState({ status: "error", message: "This invite link isn't valid." });
        return;
      }

      try {
        const [profile, currentUserId] = await Promise.all([
          searchProfileById(normalizedCode),
          getCurrentUserId(),
        ]);
        if (!active) return;

        if (!profile) {
          setState({ status: "error", message: "We couldn't find anyone with that NUJ code." });
          return;
        }

        if (profile.id === currentUserId) {
          setState({ status: "self" });
          return;
        }

        const { data: existingMate } = await supabase
          .from("mates")
          .select("id")
          .eq("user_id", currentUserId)
          .eq("mate_user_id", profile.id)
          .maybeSingle();
        if (!active) return;

        setState({
          status: "ready",
          profile: { id: profile.id, name: profile.username, userCode: profile.user_code },
          existingMateId: (existingMate as { id: string } | null)?.id ?? null,
        });
      } catch {
        if (active) setState({ status: "error", message: "Something went wrong. Please try again." });
      }
    };

    void lookup();
    return () => {
      active = false;
    };
  }, [code]);

  useEffect(() => {
    if (state.status !== "error" && state.status !== "self") return;

    if (state.status === "error") toast(state.message);
    navigate("/check-in", { replace: true });
  }, [state, navigate]);

  const handleAdd = async () => {
    if (state.status !== "ready" || isAdding) return;

    setIsAdding(true);
    setAddError(null);
    try {
      const row = await addCurrentUserMate({
        mateUserId: state.profile.id,
        name: state.profile.name,
        initials: buildMateInitials(state.profile.name),
      });
      navigate(`/mate/${row.id}`, { replace: true });
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Unable to add mate right now.");
      setIsAdding(false);
    }
  };

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      <div className="px-5 pb-6 nuj-safe-top-section">
        <button
          onClick={() => navigate("/dashboard", { replace: true })}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back</span>
        </button>

        {state.status === "loading" && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}

        {state.status === "error" && (
          <p className="text-sm text-muted-foreground">{state.message}</p>
        )}

        {state.status === "self" && (
          <p className="text-sm text-muted-foreground">This is your own invite link. Share it with your mates so they can add you.</p>
        )}

        {state.status === "ready" && (
          <>
            <div className="flex items-center gap-4">
              <MateAvatar initials={buildMateInitials(state.profile.name)} size="lg" />
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{state.profile.name}</h1>
                <p className="text-muted-foreground text-sm mt-1">NUJ code: {state.profile.userCode}</p>
              </div>
            </div>

            <div className="mt-8">
              {state.existingMateId ? (
                <button
                  onClick={() => navigate(`/mate/${state.existingMateId}`, { replace: true })}
                  className="w-full nuj-btn-primary h-12 rounded-2xl"
                >
                  Already mates · View
                </button>
              ) : (
                <button
                  onClick={() => void handleAdd()}
                  disabled={isAdding}
                  className="w-full nuj-btn-primary h-12 rounded-2xl disabled:opacity-60"
                >
                  {isAdding ? "Adding…" : "Add mate"}
                </button>
              )}
              {addError && <p className="mt-3 text-sm text-destructive">{addError}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AddMateFromLink;
