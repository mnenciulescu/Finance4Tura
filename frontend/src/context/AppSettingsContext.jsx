import { createContext, useContext, useState, useEffect } from "react";
import { getAppSettings, putAppSettings } from "../api/appSettings";

const DEFAULTS = {
  backstageEnabled:     true,
  googleLoginEnabled:   true,
  createAccountEnabled: true,
};

const AppSettingsContext = createContext({ settings: DEFAULTS, saveSettings: async () => {} });

export function AppSettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS);

  useEffect(() => {
    getAppSettings()
      .then(data => setSettings({ ...DEFAULTS, ...data }))
      .catch(() => {}); // silently fall back to defaults
  }, []);

  const saveSettings = async (patch) => {
    const next = { ...settings, ...patch };
    const saved = await putAppSettings(next);
    setSettings({ ...DEFAULTS, ...saved });
    return saved;
  };

  return (
    <AppSettingsContext.Provider value={{ settings, saveSettings }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  return useContext(AppSettingsContext);
}
