import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Support = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto px-5 pt-12 pb-16">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft size={18} />
        <span className="text-sm">Back</span>
      </button>

      <h1 className="text-2xl font-bold tracking-tight">Support</h1>
      <p className="text-sm text-muted-foreground mt-2">Need a hand? We are here to help.</p>

      <div className="nuj-card p-4 mt-5 space-y-4 text-sm text-muted-foreground">
        <div>
          <p className="text-foreground font-medium mb-1">Common checks</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Confirm the email address used for sign in</li>
            <li>Check spam/junk folders for verification emails</li>
            <li>Request a fresh password reset email</li>
            <li>Use the latest app version</li>
          </ul>
        </div>

        <div>
          <p className="text-foreground font-medium mb-1">Contact</p>
          <p>
            Email: <a href="mailto:charlie@nuj.social" className="underline">charlie@nuj.social</a>
          </p>
        </div>

        <div>
          <p className="text-foreground font-medium mb-1">When reporting a bug, include</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>A short description of what happened</li>
            <li>Device type (iPhone, Android, Web)</li>
            <li>App version if known</li>
            <li>Screenshots when helpful</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default Support;