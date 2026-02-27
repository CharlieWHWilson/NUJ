import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MessageSquare, Mail, Phone, Zap } from "lucide-react";
import { mates } from "@/data/mockData";
import { MateAvatar } from "@/components/MateComponents";
import { presenceLabel } from "@/data/mockData";

const MatePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const mate = mates.find((m) => m.id === id);

  if (!mate) return null;

  const actions = [
    {
      label: "Send NUJ",
      icon: <Zap size={20} />,
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
      </div>
    </div>
  );
};

export default MatePage;
