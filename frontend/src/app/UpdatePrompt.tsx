import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useToast } from "../ui/Toast";

/**
 * When the service worker has a new version, offer a reload instead of
 * requiring the app to be closed and reopened (proposal §10.4).
 */
export function UpdatePrompt() {
  const { show } = useToast();
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      // Check for updates whenever the app comes back to the foreground.
      if (!reg) return;
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") reg.update().catch(() => {});
      });
    },
  });

  useEffect(() => {
    if (!needRefresh) return;
    show({
      message: "New version available",
      icon: "download",
      duration: 0,
      action: { label: "Reload", onAction: () => updateServiceWorker(true) },
    });
  }, [needRefresh, show, updateServiceWorker]);

  return null;
}
