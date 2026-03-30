import { useState } from "react";
import { ClipboardCopy, MessageSquare, Mail, Phone, Share2 } from "lucide-react";
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
  saveDailyReminderSettings,
  scheduleDailyReminderNotification,
} from "@/lib/dailyReminder";
import { getCurrentUser, logoutUser } from "@/lib/auth";
import { CHECKIN_STORAGE_KEY } from "@/hooks/useCheckin";

const Profile = () => {
  const navigate = useNavigate();
  const initialReminderSettings = loadDailyReminderSettings();
  const user = getCurrentUser();

  const [dailyReminderEnabled, setDailyReminderEnabled] = useState(initialReminderSettings.enabled);
  const [reminderTime, setReminderTime] = useState(initialReminderSettings.time);

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

    if (!("Notification" in window)) {
      alert("Push notifications are not supported in this browser.");
      return;
    }

    const permission = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

    if (permission !== "granted") {
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

  const handleLogout = () => {
    localStorage.removeItem(CHECKIN_STORAGE_KEY);
    logoutUser();
    navigate("/auth");
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      <div className="px-5 pt-12 pb-6">
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

      <div className="px-5 pb-16 space-y-4">
        <div className="nuj-card p-4 space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={user.name} readOnly className="mt-2" />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={user.email} readOnly className="mt-2" />
          </div>
          <div>
            <Label>Phone</Label>
            <Input value={user.phone} readOnly className="mt-2" />
          </div>
          <div className="flex items-center gap-2">
            <Label>User ID:</Label>
            <span className="text-sm text-muted-foreground">{user.id}</span>
            <button
              type="button"
              className="ml-2 p-1 rounded hover:bg-accent transition-colors"
              title="Copy User ID"
              onClick={() => {
                navigator.clipboard.writeText(user.id);
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
          {/* Share Dialog */}
          <Dialog open={shareOpen} onOpenChange={setShareOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle>Send your User ID</DialogTitle>
              </DialogHeader>
              <div className="space-y-2">
                {/* Share message removed from card, only in share options */}
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`Join me on NUJ - an easy way to stay connected.\n\nGet started at https://charliewhwilson.github.io/NUJ\n\nAdd me by using the ID: ${user.id}`);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left"
                >
                  <ClipboardCopy size={17} className="text-muted-foreground" />
                  <span className="text-sm font-medium">Copy message</span>
                </button>
                <button
                  onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Join me on NUJ - an easy way to stay connected.\n\nGet started at https://charliewhwilson.github.io/NUJ\n\nAdd me by using the ID: ${user.id}`)}`, "_blank")}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left"
                >
                  <MessageSquare size={17} className="text-muted-foreground" />
                  <span className="text-sm font-medium">WhatsApp</span>
                </button>
                <button
                  onClick={() => window.open(`sms:?&body=${encodeURIComponent(`Join me on NUJ - an easy way to stay connected.\n\nGet started at https://charliewhwilson.github.io/NUJ\n\nAdd me by using the ID: ${user.id}`)}`, "_blank")}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors text-left"
                >
                  <Phone size={17} className="text-muted-foreground" />
                  <span className="text-sm font-medium">SMS</span>
                </button>
                <button
                  onClick={() => window.open(`mailto:?subject=${encodeURIComponent("Join me on NUJ!")}&body=${encodeURIComponent(`Join me on NUJ - an easy way to stay connected.\n\nGet started at https://charliewhwilson.github.io/NUJ\n\nAdd me by using the ID: ${user.id}`)}`, "_blank")}
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
              className="mt-2"
            />
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full h-11 rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors text-sm font-medium"
        >
          Log out
        </button>
      </div>
    </div>
  );
};

export default Profile;
