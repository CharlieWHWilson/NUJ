import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import { Analytics } from "@vercel/analytics/react";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
	<>
		<App />
		{!Capacitor.isNativePlatform() && <Analytics />}
	</>
);
