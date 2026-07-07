import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

const UpdatePassword = () => {
  const navigate = useNavigate();
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
    const { data } = supabase.auth.onAuthStateChange(async (event) => {
      if (event !== "PASSWORD_RECOVERY" && event !== "SIGNED_IN") {
        return;
      }

      await resolveRecoverySession();
    });

    void (async () => {
      const isRecoveryLink = window.location.hash.includes("type=recovery")
        || window.location.search.includes("type=recovery");

      const hasSession = await resolveRecoverySession();

      if (!hasSession && isRecoveryLink) {
        setStatus("This reset link is missing, invalid, or expired. Request a new password reset email.");
      }
    })();

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

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
    setTimeout(() => {
      navigate("/auth");
    }, 1200);
  }

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto px-5 nuj-safe-top-section nuj-safe-bottom-page">
      <div className="mb-8">
        <button
          onClick={() => navigate("/profile")}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back to profile
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