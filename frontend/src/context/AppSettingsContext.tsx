import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { getAppSettings, putAppSettings } from "../api/appSettings";

export interface AppSettings {
  backstageEnabled: boolean;
  googleLoginEnabled: boolean;
  createAccountEnabled: boolean;
}

const DEFAULTS: AppSettings = {
  backstageEnabled:     true,
  googleLoginEnabled:   true,
  createAccountEnabled: true,
};

interface AppSettingsContextValue {
  settings: AppSettings;
  saveSettings: (patch: Partial<AppSettings>) => Promise<unknown>;
  loaded: boolean;
}

const AppSettingsContext = createContext<AppSettingsContextValue>({ settings: DEFAULTS, saveSettings: async () => {}, loaded: false });

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getAppSettings()
      .then(data => setSettings({ ...DEFAULTS, ...data }))
      .catch(() => {}) // silently fall back to defaults
      .finally(() => setLoaded(true));
  }, []);

  const saveSettings = async (patch: Partial<AppSettings>) => {
    const next = { ...settings, ...patch };
    const saved = await putAppSettings(next);
    setSettings({ ...DEFAULTS, ...saved });
    return saved;
  };

  return (
    <AppSettingsContext.Provider value={{ settings, saveSettings, loaded }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAppSettings() {
  return useContext(AppSettingsContext);
}
