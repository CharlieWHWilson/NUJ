import { useState } from "react";
import { ClipboardCopy, MessageSquare, Mail, Phone, Share2, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  loadDailyReminderSettings,
  requestDailyReminderPermission,
  saveDailyReminderSettings,
  scheduleDailyReminderNotification,
} from "@/lib/dailyReminder";
import { logoutUser } from "@/lib/auth";
import { clearAppStorage } from "@/lib/utils";
import { CHECKIN_STORAGE_KEY } from "@/hooks/useCheckin";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { supabase } from "@/lib/supabase";

const Profile = () => {
  const navigate = useNavigate();
  const initialReminderSettings = loadDailyReminderSettings();
  const user = useCurrentUser();

  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(initialReminderSettings.enabled);
  const [reminderTime, setReminderTime] = useState(initialReminderSettings.time);
  const [resetRequested, setResetRequested] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const shareUserCode = user?.userCode ?? user?.id ?? "";

  const persistReminderSettings = (nextEnabled: boolean, nextTime: string) => {
    saveDailyReminderSettings({
      enabled: nextEnabled,
      time: nextTime,
    });
    scheduleDailyReminderNotification();
  };

  const handleToggleReminder = async (checked: boolean) => {
    if (!checked) {
      setDailyReminderEnabled(false);
      persistReminderSettings(false, reminderTime);
      return;
    }

    const hasPermission = await requestDailyReminderPermission();
    if (!hasPermission) {
      alert("Allow notifications to enable daily check-in reminders.");
      setDailyReminderEnabled(false);
      persistReminderSettings(false, reminderTime);
      return;
    }

    setDailyReminderEnabled(true);
    persistReminderSettings(true, reminderTime);
  };

  const handleChangeReminderTime = (value: string) => {
    setReminderTime(value);
    persistReminderSettings(dailyReminderEnabled, value);
  };

  const [shareOpen, setShareOpen] = useState(false);

  const handleLogout = async () => {
    clearAppStorage();
    await logoutUser();
    navigate("/auth");
  };

  const handleResetPassword = async () => {
    if (resetRequested || isSending) {
      return;
    }

    setResetRequested(true);
    setIsSending(true);

    const { data, error: userError } = await supabase.auth.getUser();

    if (userError) {
      console.error(userError.message);
      setIsSending(false);
      return;
    }

    const email = data.user?.email;

    if (!email) {
      console.error("No email found for this account.");
      setIsSending(false);
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/account/update-password`,
    });

    if (error) {
      console.error(error.message);
      setIsSending(false);
      return;
    }

    setIsSending(false);
  };

  const handleDeleteAccount = async () => {
    if (isDeletingAccount) {
      return;
    }

    const confirmed = window.confirm("This will permanently delete your account. Are you sure?");
    if (!confirmed) {
      return;
    }

    setIsDeletingAccount(true);

    try {
      const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
      const accessToken = refreshedData.session?.access_token;

      if (refreshError || !accessToken) {
        throw new Error("You must be logged in to delete your account.");
      }

      const { error } = await supabase.functions.invoke("delete-account", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (error) {
        console.error("Delete account function error:", error);
        alert(error.message || "Failed to delete account.");
        return;
      }

      clearAppStorage();
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) {
        console.warn("Local sign-out warning after account deletion:", signOutError);
      }
      navigate("/auth", { replace: true });
    } catch (error) {
      console.error("Unexpected delete account error:", error);
      const message = error instanceof Error ? error.message : "Failed to delete account.";
      alert(message);
    } finally {
      setIsDeletingAccount(false);
    }
  };

  if (user === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground">
        Loading profile...
      </div>
    );
  }

  if (user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground px-5 text-center">
        <div>
          <p className="text-lg font-medium">Unable to load profile</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account appears to be authenticated, but profile details could not be retrieved.
            Refresh the page or log out and back in to recover.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto relative">
      <div className="px-5 pb-6 nuj-safe-top-section">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back</span>
        </button>

        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">Your account and reminders</p>
      </div>

      <div className="px-5 space-y-4 nuj-safe-bottom-page">
        <div className="nuj-card p-4 space-y-4">
          <div>
            <Label>Username</Label>
            <Input value={user.username} readOnly className="mt-2" />
          </div>
          {user.email && (
            <div>
              <Label>Email</Label>
              <Input value={user.email} readOnly className="mt-2" />
            </div>
          )}
          <div className="flex items-center gap-2">
            <Label>NUJ code:</Label>
            <span className="text-sm text-muted-foreground">{shareUserCode}</span>
            <button
              type="button"
              className="ml-2 p-1 rounded hover:bg-accent transition-colors"
              title="Copy NUJ code"
              onClick={() => {
                navigator.clipboard.writeText(shareUserCode);
              }}
            >
              <ClipboardCopy size={16} />
            </button>
            <button
              type="button"
              className="ml-1 p-1 rounded hover:bg-accent transition-colors"
              title="Send to mate"
              onClick={() => setShareOpen(true)}
            >
              <Share2 size={16} />
            </button>
          </div>
          <button
            type="button"
            onClick={handleResetPassword}
            disabled={resetRequested || isSending}
            className="text-xs font-medium lowercase text-muted-foreground underline underline-offset-4 hover:text-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSending ? "sending..." : "reset password"}
          </button>
          {/* Share Dialog */}
          <Dialog open={shareOpen} onOpenChange={setShareOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Send your NUJ code</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                {/* Share message removed from card, only in share options */}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(shareUserCode);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left"
                >
                  <ClipboardCopy size={17} className="text-muted-foreground" />
                  <span className="text-sm font-medium">Copy message</span>
                </button>
                <button
                  onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(shareUserCode)}`, "_blank")}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left"
                >
                  <MessageSquare size={17} className="text-muted-foreground" />
                  <span className="text-sm font-medium">WhatsApp</span>
                </button>
                <button
                  onClick={() => window.open(`sms:?&body=${encodeURIComponent(shareUserCode)}`, "_blank")}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left"
                >
                  <Phone size={17} className="text-muted-foreground" />
                  <span className="text-sm font-medium">SMS</span>
                </button>
                <button
                  onClick={() => window.open(`mailto:?subject=${encodeURIComponent("Your NUJ code")}&body=${encodeURIComponent(shareUserCode)}`, "_blank")}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left"
                >
                  <Mail size={17} className="text-muted-foreground" />
                  <span className="text-sm font-medium">Email</span>
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="nuj-card p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium text-sm">Daily check-in reminder</p>
              <p className="text-xs text-muted-foreground mt-1">Receive a push notification at your selected time</p>
            </div>
            <Switch
              checked={dailyReminderEnabled}
              onCheckedChange={handleToggleReminder}
              aria-label="Enable daily check-in reminder"
            />
          </div>

          <div>
            <Label htmlFor="reminder-time">Reminder time</Label>
            <Input
              id="reminder-time"
              type="time"
              value={reminderTime}
              onChange={(event) => handleChangeReminderTime(event.target.value)}
              disabled={!dailyReminderEnabled}
              className="mt-2 w-full sm:w-1/2"
            />
          </div>
        </div>

        <button
          onClick={handleLogout}
          disabled={isDeletingAccount}
          className="w-full h-11 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
        >
          Log out
        </button>
      </div>

      <button
        onClick={handleDeleteAccount}
        disabled={isDeletingAccount}
        aria-label="Delete account"
        title="Delete account"
        className="absolute bottom-5 right-5 h-9 w-9 rounded-full border border-destructive/50 text-destructive bg-background/90 backdrop-blur-sm flex items-center justify-center hover:bg-destructive/10 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
};

export default Profile;
