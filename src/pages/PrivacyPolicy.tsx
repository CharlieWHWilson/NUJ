import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

const PrivacyPolicy = () => {
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

      <h1 className="text-2xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="text-xs text-muted-foreground mt-2">Last updated: November 2026</p>

      <div className="nuj-card p-4 mt-5 space-y-4 text-sm text-muted-foreground">
        <p>
          At NUJ, we believe staying connected should be simple, and understanding how your data is used
          should be simple too.
        </p>

        <div>
          <p className="text-foreground font-medium mb-1">Information we collect</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Name or display name</li>
            <li>Email address</li>
            <li>Check-ins, NUJs sent and received, and connection data</li>
            <li>Notification preferences</li>
            <li>Limited technical data such as app version and device type</li>
          </ul>
        </div>

        <div>
          <p className="text-foreground font-medium mb-1">How we use your data</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Create and manage your account</li>
            <li>Enable check-ins and NUJs</li>
            <li>Send optional reminders if enabled</li>
            <li>Improve reliability, security, and support</li>
          </ul>
        </div>

        <p>We do not sell your personal information.</p>

        <div>
          <p className="text-foreground font-medium mb-1">Offer maps</p>
          <p>
            Opening the offers map loads map tiles from OpenStreetMap. The provider receives
            technical request data such as your IP address and the map area requested.
            NUJ does not request your device location for this map. Venue administrators can
            choose to send a venue address to OpenStreetMap Nominatim to find its coordinates;
            confirmed coordinates are saved with the venue.
          </p>
          <a href="https://osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noopener noreferrer" className="underline">
            OpenStreetMap privacy policy
          </a>
        </div>

        <div>
          <p className="text-foreground font-medium mb-1">Account deletion</p>
          <p>
            You can delete your account in-app. Data is deleted or anonymized within a reasonable
            period unless retention is required by law.
          </p>
        </div>

        <p>
          Questions about privacy: <a href="mailto:charlie@nuj.social" className="underline">charlie@nuj.social</a>
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;