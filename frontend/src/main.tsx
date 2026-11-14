import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/inter";
import "./theme/tokens.css";
import "./theme/themes.css";
import "./theme/base.css";
import App from "./App";
import { captureInstallPrompt } from "./app/install";

// Must run before the browser fires beforeinstallprompt.
captureInstallPrompt();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
