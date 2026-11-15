import { useMemo } from "react";
import { useTheme } from "./ThemeProvider";
import { tokenName } from "./domainColors";

/**
 * Resolves CSS variables to concrete colour strings for Recharts props that
 * cannot take var() (gradient stops, some SVG attributes in older engines).
 * Re-reads whenever the applied theme changes.
 *
 * Pass either token names ("--tint") or var() strings ("var(--tint)").
 */
export function useResolvedColors<T extends Record<string, string>>(tokens: T): T {
  const { theme } = useTheme();
  const key = JSON.stringify(tokens);
  return useMemo(() => {
    const out = {} as Record<string, string>;
    const styles = typeof window !== "undefined" ? getComputedStyle(document.documentElement) : null;
    for (const [k, v] of Object.entries(tokens)) {
      const name = tokenName(v);
      const resolved = styles?.getPropertyValue(name).trim();
      out[k] = resolved || v;
    }
    return out as T;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, key]);
}
