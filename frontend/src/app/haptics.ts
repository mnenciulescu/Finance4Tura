// Haptic feedback (proposal §3.6). Android exposes navigator.vibrate; iPhone
// Safari exposes no vibration API, so there this is a no-op. Respects the
// Settings → Haptics toggle.

export type HapticKind = "light" | "success" | "warning";

export const HAPTICS_KEY = "uiHaptics";

const PATTERNS: Record<HapticKind, number | number[]> = {
  light:   8,
  success: [10, 40, 14],
  warning: 20,
};

export function hapticsSupported(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.vibrate === "function";
}

export function hapticsEnabled(): boolean {
  try {
    return localStorage.getItem(HAPTICS_KEY) !== "false";
  } catch {
    return true;
  }
}

export function setHapticsEnabled(on: boolean) {
  try {
    localStorage.setItem(HAPTICS_KEY, String(on));
  } catch {
    /* ignore */
  }
}

export function haptic(kind: HapticKind = "light") {
  if (!hapticsSupported() || !hapticsEnabled()) return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    /* some browsers throw without a user gesture — harmless */
  }
}
