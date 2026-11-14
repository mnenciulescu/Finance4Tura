// Theme registry. Adding a theme = one [data-theme="x"] block in themes.css
// plus one entry here; the Settings picker renders from this list.
//
// metaColor feeds <meta name="theme-color"> (Android status bar, iOS overscroll
// colour) and must match the theme's --bg-grouped.

export type ThemeId = "light" | "dark";
export type ThemeSetting = "auto" | ThemeId;

export interface ThemeDef {
  id: ThemeId;
  label: string;
  scheme: "light" | "dark";
  metaColor: string;
}

export const THEMES: ThemeDef[] = [
  { id: "light", label: "Light", scheme: "light", metaColor: "#F2F2F7" },
  { id: "dark",  label: "Dark",  scheme: "dark",  metaColor: "#000000" },
];

export const THEME_SETTINGS: ThemeSetting[] = ["auto", ...THEMES.map(t => t.id)];

export const THEME_KEY = "uiTheme";
/** Pre-redesign key, migrated once by the boot script in index.html. */
export const LEGACY_THEME_KEY = "appTheme";

export function readThemeSetting(): ThemeSetting {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    return stored === "light" || stored === "dark" ? stored : "auto";
  } catch {
    return "auto";
  }
}

export function writeThemeSetting(setting: ThemeSetting) {
  try {
    localStorage.setItem(THEME_KEY, setting);
  } catch {
    /* storage unavailable — the choice lasts for this session only */
  }
}

/**
 * The same migration the boot script performs, for code paths (and tests)
 * that run without index.html. Old "light" stays light; every other stored
 * theme (Dusk, Amber and their predecessors) becomes Dark.
 */
export function migrateLegacyTheme() {
  try {
    if (localStorage.getItem(THEME_KEY) !== null) return;
    const old = localStorage.getItem(LEGACY_THEME_KEY);
    if (old === null) return;
    localStorage.setItem(THEME_KEY, old === "light" ? "light" : "dark");
    localStorage.removeItem(LEGACY_THEME_KEY);
  } catch {
    /* ignore */
  }
}

export const systemPrefersDark = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;

export function resolveTheme(setting: ThemeSetting): ThemeId {
  if (setting === "auto") return systemPrefersDark() ? "dark" : "light";
  return setting;
}

export function applyTheme(theme: ThemeId) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  const def = THEMES.find(t => t.id === theme);
  if (!def) return;
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute("content", def.metaColor));
}
