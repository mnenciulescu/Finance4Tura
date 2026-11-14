import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

/**
 * Sensitive-value visibility (proposal §7).
 *
 * - Income amounts follow the same `incomePrivacy` key as before
 *   ("true" = visible), so an existing preference carries over. Settings edits
 *   it; the Budget eye button toggles it and persists it, as the old ⋮ toggle did.
 * - "Hide content in app switcher" blurs the app while it is in the background.
 */

export const PRIVACY_KEY = "incomePrivacy";
export const SHIELD_KEY = "uiPrivacyShield";

const read = (key: string) => {
  try { return localStorage.getItem(key) === "true"; } catch { return false; }
};
const write = (key: string, v: boolean) => {
  try { localStorage.setItem(key, String(v)); } catch { /* ignore */ }
};

interface PrivacyContextValue {
  incomeVisible: boolean;
  setIncomeVisible: (v: boolean) => void;
  shieldEnabled: boolean;
  setShieldEnabled: (v: boolean) => void;
}

const PrivacyContext = createContext<PrivacyContextValue>({
  incomeVisible: false,
  setIncomeVisible: () => {},
  shieldEnabled: false,
  setShieldEnabled: () => {},
});

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [incomeVisible, setVisible] = useState(() => read(PRIVACY_KEY));
  const [shieldEnabled, setShield] = useState(() => read(SHIELD_KEY));

  const setIncomeVisible = useCallback((v: boolean) => { write(PRIVACY_KEY, v); setVisible(v); }, []);
  const setShieldEnabled = useCallback((v: boolean) => { write(SHIELD_KEY, v); setShield(v); }, []);

  // App-switcher shield: blur while the page is hidden.
  useEffect(() => {
    if (!shieldEnabled) return;
    const onVis = () => document.body.classList.toggle("privacy-shield", document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onVis);
      document.body.classList.remove("privacy-shield");
    };
  }, [shieldEnabled]);

  const value = useMemo(
    () => ({ incomeVisible, setIncomeVisible, shieldEnabled, setShieldEnabled }),
    [incomeVisible, setIncomeVisible, shieldEnabled, setShieldEnabled],
  );
  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const usePrivacy = () => useContext(PrivacyContext);
