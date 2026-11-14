import { useState } from "react";
import { INSTALL_BANNER_KEY, useInstall } from "../../app/install";
import { Button, IconButton, Icon } from "../../ui";
import { InstallInstructionsSheet } from "../account/settings/InstallInstructions";
import s from "./Today.module.css";

const dismissed = () => { try { return localStorage.getItem(INSTALL_BANNER_KEY) === "true"; } catch { return true; } };

/** One-time, dismissible "Install the app" banner, only when not installed (§10.4). */
export function InstallBanner() {
  const install = useInstall();
  const [hidden, setHidden] = useState(dismissed);
  const [instructions, setInstructions] = useState(false);
  if (hidden || !install.mode) return null;

  const dismiss = () => {
    try { localStorage.setItem(INSTALL_BANNER_KEY, "true"); } catch { /* ignore */ }
    setHidden(true);
  };

  return (
    <div className={s.install} role="region" aria-label="Install the app">
      <Icon name="phone" size={22} />
      <span className={s.installText}>Install 4TURA Home for full-screen use and offline access.</span>
      <Button
        variant="filled"
        size="small"
        onClick={() => (install.mode === "prompt" ? install.prompt().then(dismiss) : setInstructions(true))}
      >
        Install
      </Button>
      <IconButton icon="xmark" label="Dismiss" size={18} onClick={dismiss} />
      <InstallInstructionsSheet isOpen={instructions} onClose={() => { setInstructions(false); dismiss(); }} />
    </div>
  );
}
