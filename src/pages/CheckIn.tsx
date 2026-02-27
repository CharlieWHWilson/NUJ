import { useNavigate } from "react-router-dom";
import { TopNav } from "@/components/TopNav";
import { useCheckin } from "@/hooks/useCheckin";

const CheckIn = () => {
  const navigate = useNavigate();
  const { checkedIn, doCheckin } = useCheckin();

  const handleCheckin = () => {
    doCheckin();
    setTimeout(() => navigate("/dashboard"), 300);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-md mx-auto">
      <TopNav />

      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-20">
        {/* Ambient subtle circle */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 60% 40% at 50% 55%, hsl(33 90% 58% / 0.07) 0%, transparent 70%)",
          }}
        />

        <div className="relative text-center">
          <p className="text-muted-foreground text-sm font-medium mb-16 tracking-wide uppercase" style={{ letterSpacing: "0.1em" }}>
            {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
          </p>

          <button
            onClick={handleCheckin}
            disabled={checkedIn}
            className="nuj-btn-primary w-64 h-64 rounded-full flex flex-col items-center justify-center gap-3 mx-auto shadow-xl disabled:opacity-70 disabled:cursor-default"
            style={{
              boxShadow: checkedIn
                ? "0 8px 32px hsl(33 90% 58% / 0.2)"
                : "0 8px 40px hsl(215 28% 13% / 0.18)",
              background: checkedIn
                ? "hsl(var(--accent))"
                : "hsl(var(--primary))",
              color: checkedIn
                ? "hsl(var(--accent-foreground))"
                : "hsl(var(--primary-foreground))",
            }}
          >
            <span className="text-5xl">{checkedIn ? "✓" : "👍"}</span>
            <span className="text-xl font-semibold tracking-tight">
              {checkedIn ? "You're in" : "You good?"}
            </span>
          </button>

          {!checkedIn && (
            <p className="text-muted-foreground text-sm mt-12 max-w-xs mx-auto leading-relaxed">
              One tap. No message. Just letting your mates know you're around.
            </p>
          )}

          {checkedIn && (
            <p className="text-muted-foreground text-sm mt-12 max-w-xs mx-auto leading-relaxed">
              Your mates will see you're around today.
            </p>
          )}
        </div>
      </div>

      <div className="pb-10 text-center">
        <button
          onClick={() => navigate("/dashboard")}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground transition-colors"
        >
          See who's around →
        </button>
      </div>
    </div>
  );
};

export default CheckIn;
