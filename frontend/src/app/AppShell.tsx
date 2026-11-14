import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TabBar } from "./TabBar";
import { ErrorBoundary } from "./ErrorBoundary";
import { ACCOUNT_SCREENS, TABS, tabForPath, type TabId } from "./navigation";
import { currentTab, savedScroll } from "./tabHistory";
import { isIOS } from "./platform";
import { useOnline } from "./useOnline";
import { Icon } from "../ui/icons/Icon";
import s from "./AppShell.module.css";

const EDGE = 24;
const SWIPE_BACK = 80;

/** Where a pushed screen goes back to when there is no in-app history. */
function parentOf(pathname: string, ownerTab: TabId | undefined): string | null {
  if (pathname === "/hq/settings") return "/hq";
  if (ACCOUNT_SCREENS.includes(pathname)) return TABS.find(t => t.id === (ownerTab ?? "today"))!.root;
  return null;
}

/**
 * Root layout (proposal §6.1): the centred 430 px column, the tab bar, the
 * offline banner, per-tab scroll restoration and iPhone edge-swipe back.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const online = useOnline();
  const tab = currentTab(location);
  const prevTab = useRef<TabId>(tab);
  const prevPath = useRef(location.pathname);

  // Restore each tab's scroll position when switching to it; pushed screens start at the top.
  useLayoutEffect(() => {
    if (prevTab.current !== tab) {
      window.scrollTo(0, savedScroll(tab));
    } else if (prevPath.current !== location.pathname) {
      window.scrollTo(0, 0);
    }
    prevTab.current = tab;
    prevPath.current = location.pathname;
  }, [tab, location.pathname]);

  // Installed iPhone PWAs have no back gesture, so pushed screens get one.
  // Disabled on Android, whose system back gesture uses the same edge.
  useEffect(() => {
    if (!isIOS()) return;
    const ownerTab = (location.state as { ownerTab?: TabId } | null)?.ownerTab;
    const parent = parentOf(location.pathname, ownerTab);
    if (!parent) return;
    let startX: number | null = null;
    let startY = 0;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startX = t.clientX <= EDGE ? t.clientX : null;
      startY = t.clientY;
    };
    const onEnd = (e: TouchEvent) => {
      if (startX == null) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - startX;
      const dy = Math.abs(t.clientY - startY);
      startX = null;
      if (dx > SWIPE_BACK && dy < 60) {
        if (location.key !== "default") navigate(-1);
        else navigate(parent, { replace: true });
      }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchend", onEnd);
    };
  }, [location, navigate]);

  return (
    <div className={s.shell} data-tab={tabForPath(location.pathname)}>
      {!online && (
        <div className={s.offline} role="status">
          <Icon name="wifiSlash" size={16} weight="semibold" />
          <span>Offline — showing saved data</span>
        </div>
      )}
      <ErrorBoundary resetKey={location.pathname}>{children}</ErrorBoundary>
      <TabBar />
    </div>
  );
}
