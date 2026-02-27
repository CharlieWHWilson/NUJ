import { Share2, MessageSquare, Mail, Link } from "lucide-react";

interface AddMateSheetProps {
  open: boolean;
  onClose: () => void;
}

export const AddMateSheet = ({ open, onClose }: AddMateSheetProps) => {
  if (!open) return null;

  const shareOptions = [
    {
      label: "WhatsApp",
      icon: <MessageSquare size={18} />,
      onClick: () => {
        window.open("https://wa.me/?text=Join+me+on+NUJ+—+staying+connected+without+the+effort.+%5Blink%5D", "_blank");
        onClose();
      },
    },
    {
      label: "SMS",
      icon: <MessageSquare size={18} />,
      onClick: () => {
        window.open("sms:?body=Join+me+on+NUJ", "_blank");
        onClose();
      },
    },
    {
      label: "Email",
      icon: <Mail size={18} />,
      onClick: () => {
        window.open("mailto:?subject=Join+me+on+NUJ&body=Hey%2C+join+me+on+NUJ.", "_blank");
        onClose();
      },
    },
    {
      label: "Copy invite link",
      icon: <Link size={18} />,
      onClick: () => {
        navigator.clipboard.writeText("https://nuj.app/invite/abc123");
        onClose();
      },
    },
  ];

  return (
    <>
      <div
        className="fixed inset-0 bg-foreground/20 z-40"
        onClick={onClose}
      />
      <div className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto bg-card rounded-t-3xl p-6 pb-10 border border-border"
        style={{ boxShadow: "0 -4px 40px hsl(215 28% 13% / 0.12)" }}
      >
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-6" />
        <div className="flex items-center gap-2 mb-6">
          <Share2 size={16} className="text-muted-foreground" />
          <h2 className="font-semibold">Add a mate</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Invite them to NUJ. Once they join, you'll both be connected.
        </p>
        <div className="space-y-2">
          {shareOptions.map((opt) => (
            <button
              key={opt.label}
              onClick={opt.onClick}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-muted/50 hover:bg-muted transition-colors text-left"
            >
              <span className="text-muted-foreground">{opt.icon}</span>
              <span className="font-medium text-sm">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
