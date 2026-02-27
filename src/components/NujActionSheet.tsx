import { MessageSquare, Mail, Phone } from "lucide-react";
import { NujReceived, Mate } from "@/data/mockData";
import { MateAvatar } from "@/components/MateComponents";

interface NujActionSheetProps {
  nuj: NujReceived;
  mate: Mate;
  onClose: () => void;
  onActionComplete: (nujId: string) => void;
}

export const NujActionSheet = ({ nuj, mate, onClose, onActionComplete }: NujActionSheetProps) => {
  if (!nuj || !mate) return null;

  const completeAction = () => {
    onActionComplete(nuj.id);
    onClose();
  };

  const actions = [
    {
      label: "NUJ back",
      icon: <span className="text-base leading-none">👉</span>,
      onClick: () => {
        alert(`NUJ sent back to ${mate.name}`);
        completeAction();
      },
    },
    {
      label: "WhatsApp",
      icon: <MessageSquare size={18} />,
      onClick: () => {
        window.open(`https://wa.me/`, "_blank");
        completeAction();
      },
    },
    {
      label: "SMS",
      icon: <Phone size={18} />,
      onClick: () => {
        window.open(`sms:`, "_blank");
        completeAction();
      },
    },
    {
      label: "Email",
      icon: <Mail size={18} />,
      onClick: () => {
        window.open(`mailto:`, "_blank");
        completeAction();
      },
    },
  ];

  return (
    <>
      <div className="fixed inset-0 bg-foreground/20 z-40" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 max-w-md mx-auto bg-card rounded-t-3xl p-6 pb-10 border border-border"
        style={{ boxShadow: "0 -4px 40px hsl(215 28% 13% / 0.12)" }}
      >
        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-6" />
        <div className="flex items-center gap-3 mb-6">
          <MateAvatar initials={nuj.fromMateInitials} size="md" />
          <div>
            <p className="font-semibold">{nuj.fromMateName} NUJ'd you</p>
            <p className="text-xs text-muted-foreground">{nuj.time}</p>
          </div>
        </div>
        <div className="space-y-2">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-muted/50 hover:bg-muted transition-colors text-left"
            >
              <span className="text-muted-foreground">{action.icon}</span>
              <span className="font-medium text-sm">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
