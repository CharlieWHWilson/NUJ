import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, MessageSquare, Mail, Phone, Trash2 } from "lucide-react";
import { mates, removeMateFromData } from "@/data/mockData";
import { MateAvatar } from "@/components/MateComponents";
import { presenceLabel } from "@/data/mockData";

const MatePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [showRemovePrompt, setShowRemovePrompt] = useState(false);
  const mate = mates.find((m) => m.id === id);

  if (!mate) return null;

  const actions = [
    {
      label: "Send NUJ",
      icon: <span className="text-lg leading-none">👉</span>,
      description: "A silent signal. No words needed.",
      primary: true,
      onClick: () => alert(`NUJ sent to ${mate.name}`),
    },
    {
      label: "WhatsApp",
      icon: <MessageSquare size={20} />,
      description: "Open in WhatsApp",
      primary: false,
      onClick: () => window.open(`https://wa.me/?text=Hey+${mate.name.split(" ")[0]}`, "_blank"),
    },
    {
      label: "SMS",
      icon: <Phone size={20} />,
      description: "Send a text",
      primary: false,
      onClick: () => window.open(`sms:`, "_blank"),
    },
    {
      label: "Email",
      icon: <Mail size={20} />,
      description: "Send an email",
      primary: false,
      onClick: () => window.open(`mailto:`, "_blank"),
    },
  ];

  const handleRemoveMate = () => {
    const removed = removeMateFromData(mate.id);
    if (removed) {
      navigate("/mates");
    }
  };

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto">
      {/* Header */}
      <div className="px-5 pt-12 pb-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Back</span>
        </button>

        <div className="flex items-center gap-4">
          <MateAvatar initials={mate.initials} size="lg" status={mate.lastCheckin} daysSinceCheckin={mate.daysSinceCheckin} />
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{mate.name}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Last checked in: {presenceLabel(mate.lastCheckin, mate.daysSinceCheckin)}
              {mate.group ? ` · ${mate.group}` : ""}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 space-y-3">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className="w-full flex items-center gap-4 p-5 rounded-2xl transition-colors text-left"
            style={{
              background: action.primary
                ? "hsl(var(--primary))"
                : "hsl(var(--card))",
              color: action.primary
                ? "hsl(var(--primary-foreground))"
                : "hsl(var(--foreground))",
              border: action.primary ? "none" : "1px solid hsl(var(--border))",
              boxShadow: action.primary ? "0 4px 20px hsl(215 28% 13% / 0.15)" : "var(--nuj-card-shadow)",
            }}
          >
            <span style={{ opacity: action.primary ? 0.9 : 0.6 }}>{action.icon}</span>
            <div>
              <p className="font-semibold">{action.label}</p>
              <p
                className="text-sm mt-0.5"
                style={{
                  color: action.primary
                    ? "hsl(var(--primary-foreground) / 0.7)"
                    : "hsl(var(--muted-foreground))",
                }}
              >
                {action.description}
              </p>
            </div>
          </button>
        ))}

        <div className="pt-2 flex justify-end">
          {!showRemovePrompt ? (
            <button
              onClick={() => setShowRemovePrompt(true)}
              className="w-9 h-9 flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:text-destructive hover:bg-muted/80 transition-colors"
              aria-label="Remove mate"
            >
              <Trash2 size={16} />
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
              <button
                onClick={handleRemoveMate}
                className="text-xs font-semibold text-destructive hover:text-destructive/80 transition-colors"
              >
                Remove mate
              </button>
              <button
                onClick={() => setShowRemovePrompt(false)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatePage;
