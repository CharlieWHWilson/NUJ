import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TermsOfUse = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background max-w-md mx-auto px-5 nuj-safe-top-section nuj-safe-bottom-page">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft size={18} />
        <span className="text-sm">Back</span>
      </button>

      <h1 className="text-2xl font-bold tracking-tight">Terms of Use</h1>
      <p className="text-xs text-muted-foreground mt-2">Last updated: July 2026</p>

      <div className="nuj-card p-4 mt-5 space-y-4 text-sm text-muted-foreground">
        <p>
          By creating an account or using NUJ, you agree to these Terms of Use.
        </p>

        <div>
          <p className="text-foreground font-medium mb-1">Using NUJ</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Provide accurate account information</li>
            <li>Keep your login details secure</li>
            <li>Use NUJ respectfully and lawfully</li>
            <li>Do not harass, abuse, impersonate, or mislead other users</li>
            <li>Do not interfere with service operations</li>
          </ul>
        </div>

        <p>
          We aim to keep NUJ available and reliable, but uninterrupted access is not guaranteed.
          Features may change as the product evolves.
        </p>

        <p>
          We may suspend or remove accounts that breach these Terms or are used for abuse,
          fraud, or unlawful activity.
        </p>

        <p>
          Questions about these Terms: <a href="mailto:charlie@nuj.social" className="underline">charlie@nuj.social</a>
        </p>
      </div>
    </div>
  );
};

export default TermsOfUse;