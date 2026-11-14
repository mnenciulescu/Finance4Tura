// Platform detection — behaviour only, never appearance (proposal §10.2).
//
// The inline script in index.html sets data-platform / data-standalone on
// <html> before first render; this module reads the same attributes (and
// falls back to detecting itself when they are absent, e.g. in tests).

export type PlatformName = "ios" | "android" | "other";

export function detectPlatform(): PlatformName {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1);
  if (isIOS) return "ios";
  const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  if (/Android/i.test(ua) || /android/i.test(uaData?.platform ?? "")) return "android";
  return "other";
}

export function detectStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return !!window.matchMedia?.("(display-mode: standalone)").matches || nav.standalone === true;
}

export function getPlatform(): PlatformName {
  const attr = typeof document !== "undefined" ? document.documentElement.dataset.platform : undefined;
  return attr === "ios" || attr === "android" || attr === "other" ? attr : detectPlatform();
}

export function isStandalone(): boolean {
  const attr = typeof document !== "undefined" ? document.documentElement.dataset.standalone : undefined;
  return attr ? attr === "true" : detectStandalone();
}

export const isIOS = () => getPlatform() === "ios";
export const isAndroid = () => getPlatform() === "android";

/** Hook form, for components. The values cannot change during a session. */
export function usePlatform() {
  return { platform: getPlatform(), standalone: isStandalone() };
}
