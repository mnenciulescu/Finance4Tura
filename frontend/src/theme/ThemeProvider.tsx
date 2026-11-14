import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  applyTheme, migrateLegacyTheme, readThemeSetting, resolveTheme, writeThemeSetting,
  type ThemeId, type ThemeSetting,
} from "./themes";

interface ThemeContextValue {
  /** What the user chose: Automatic, Light or Dark. */
  setting: ThemeSetting;
  /** The theme actually applied right now. */
  theme: ThemeId;
  setSetting: (s: ThemeSetting) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  setting: "auto",
  theme: "light",
  setSetting: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [setting, setSettingState] = useState<ThemeSetting>(() => {
    migrateLegacyTheme();
    return readThemeSetting();
  });
  const [theme, setTheme] = useState<ThemeId>(() => resolveTheme(setting));

  // Automatic follows the device live, without a reload.
  useEffect(() => {
    if (setting !== "auto" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setTheme(mq.matches ? "dark" : "light");
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [setting]);

  useEffect(() => { applyTheme(theme); }, [theme]);

  const setSetting = useCallback((s: ThemeSetting) => {
    writeThemeSetting(s);
    setSettingState(s);
    setTheme(resolveTheme(s));
  }, []);

  const value = useMemo(() => ({ setting, theme, setSetting }), [setting, theme, setSetting]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => useContext(ThemeContext);
