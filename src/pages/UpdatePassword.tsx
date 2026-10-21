import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
import { establishRecoverySession } from "@/lib/passwordRecovery";

const UpdatePassword = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [canUpdate, setCanUpdate] = useState(false);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("Follow the reset link from your email first.");
  const [loading, setLoading] = useState(false);

  const resolveRecoverySession = async () => {
    const { data: userData, error } = await supabase.auth.getUser();

    if (error || !userData.user) {
      return false;
    }

    setCanUpdate(true);
    setStatus("Token verified. Set your new password below.");
    return true;
  };

  useEffect(() => {
    let active = true;
    let pending: ReturnType<typeof setTimeout> | undefined;
    setCanUpdate(false);
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "PASSWORD_RECOVERY" && event !== "SIGNED_IN") return;
      pending = setTimeout(() => { if (active) void resolveRecoverySession(); }, 0);
    });

    void (async () => {
      try {
        await establishRecoverySession(window.location.href);
        if (!active) return;
        const hasSession = await resolveRecoverySession();
        if (!hasSession && active) setStatus("This reset link is missing, invalid, or expired. Request a new password reset email.");
      } catch (failure) {
        if (pending) clearTimeout(pending);
        if (active) {
          setCanUpdate(false);
          setStatus(failure instanceof Error ? failure.message : "Unable to verify this reset link.");
        }
      }
    })();

    return () => {
      active = false;
      if (pending) clearTimeout(pending);
      data.subscription.unsubscribe();
    };
  }, [location.key]);

  async function handleSave() {
    if (!canUpdate) {
      setStatus("Please follow the reset link from your email first.");
      return;
    }

    setLoading(true);
    setStatus("Updating password...");

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setStatus("No active user session is available on this route. Request a new password reset email.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    setStatus("Password updated ✅ You can now sign in.");
    await supabase.auth.signOut({ scope: "local" });
    setTimeout(() => {
      navigate("/auth");
    }, 1200);
  }

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto px-5 nuj-safe-top-section nuj-safe-bottom-page">
      <div className="mb-8">
        <button
          onClick={() => navigate("/auth")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to login
        </button>
        <h2 className="mt-4 text-3xl font-bold tracking-tight">Reset password</h2>
        <p className="mt-2 text-sm text-muted-foreground">Enter a new password after opening the email link.</p>
      </div>

      <div className="nuj-card p-4 space-y-4">
        <Input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          disabled={!canUpdate}
        />

        <button
          onClick={handleSave}
          disabled={!canUpdate || !password || loading}
          className="nuj-btn-primary w-full h-11 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Saving..." : "Save new password"}
        </button>

        <p className="text-sm text-muted-foreground">{status}</p>
      </div>
    </div>
  );
};

export default UpdatePassword;