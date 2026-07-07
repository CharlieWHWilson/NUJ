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

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange(async (event) => {
      if (event !== "PASSWORD_RECOVERY") {
        return;
      }

      const { data: userData, error } = await supabase.auth.getUser();

      if (error || !userData.user) {
        setCanUpdate(false);
        setStatus("Recovery link opened, but no active user session is available. Request a new password reset email.");
        return;
      }

      setCanUpdate(true);
      setStatus("Token verified. Set your new password below.");
    });

    const timeout = window.setTimeout(() => {
      setCanUpdate((currentCanUpdate) => {
        if (currentCanUpdate) {
          return currentCanUpdate;
        }

        setStatus("This reset link is missing, invalid, or expired. Request a new password reset email.");
        return currentCanUpdate;
      });
    }, 5000);

    return () => {
      window.clearTimeout(timeout);
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
    <div className="min-h-screen bg-background max-w-md mx-auto px-5 pt-12 pb-16">
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