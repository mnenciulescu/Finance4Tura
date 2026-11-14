import { useSyncExternalStore } from "react";
import { getPlatform, isStandalone } from "./platform";

/**
 * Install flow (proposal §10.4).
 *
 * Chromium (Android) fires `beforeinstallprompt`; we keep the event so the
 * Install App row / banner can show the native prompt. iPhone Safari has no
 * such event, so there the same row opens Share → Add to Home Screen
 * instructions. Once installed (standalone display mode) both are hidden.
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

export function captureInstallPrompt() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", e => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
}

export type InstallMode = "prompt" | "ios-instructions" | null;

function mode(): InstallMode {
  if (installed || isStandalone()) return null;
  if (deferred) return "prompt";
  if (getPlatform() === "ios") return "ios-instructions";
  return null;
}

const subscribe = (cb: () => void) => { listeners.add(cb); return () => listeners.delete(cb); };

export function useInstall() {
  const m = useSyncExternalStore(subscribe, mode, () => null);
  return {
    mode: m,
    async prompt() {
      if (!deferred) return;
      await deferred.prompt();
      const choice = await deferred.userChoice.catch(() => null);
      if (choice?.outcome === "accepted") installed = true;
      deferred = null;
      emit();
    },
  };
}

export const INSTALL_BANNER_KEY = "uiInstallBannerDismissed";
