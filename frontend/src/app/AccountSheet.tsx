import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { useAuth } from "../context/AuthContext";
import { useAppSettings } from "../context/AppSettingsContext";
import { getAuthToken } from "../api/client";
import { useOverlayHistory } from "./overlays";
import { ACCOUNT_ITEMS, tabForPath, visibleItems, type TabId } from "./navigation";
import { Icon } from "../ui/icons/Icon";
import { IconTile } from "../ui/List";
import o from "../ui/Overlays.module.css";
import s from "./AccountSheet.module.css";

/* ── Session countdown ────────────────────────────────────────────────────── */

function tokenExp(): number | null {
  try {
    const token = getAuthToken();
    if (!token) return null;
    return JSON.parse(atob(token.split(".")[1])).exp ?? null;
  } catch {
    return null;
  }
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSessionRemaining(): number | null {
  const calc = () => { const exp = tokenExp(); return exp ? Math.max(0, exp - Math.floor(Date.now() / 1000)) : null; };
  const [remaining, setRemaining] = useState(calc);
  useEffect(() => {
    const id = window.setInterval(() => setRemaining(calc()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return remaining;
}

// eslint-disable-next-line react-refresh/only-export-components
export function formatRemaining(seconds: number): string {
  const totalMins = Math.floor(seconds / 60);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min left` : `${m} min left`;
}

export function SessionLine() {
  const remaining = useSessionRemaining();
  if (remaining == null) return null;
  const tone = remaining <= 300 ? s.urgent : remaining <= 600 ? s.soon : "";
  return <span className={[s.session, tone].join(" ")}>Session · {formatRemaining(remaining)}</span>;
}

/* ── Account button + sheet ───────────────────────────────────────────────── */

export function AccountButton() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const initials = user?.username?.slice(0, 2).toUpperCase() ?? "?";
  return (
    <>
      <button type="button" className={s.avatar} onClick={() => setOpen(true)} aria-label="Account" aria-haspopup="dialog">
        <span className={s.avatarCircle}>{initials}</span>
      </button>
      <AccountSheet isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function AccountSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, signOut } = useAuth();
  const { settings } = useAppSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const { consume } = useOverlayHistory(isOpen, onClose);

  const items = visibleItems(ACCOUNT_ITEMS, { backstageEnabled: settings.backstageEnabled, username: user?.username });
  const ownerTab: TabId = tabForPath(location.pathname, (location.state as { ownerTab?: TabId } | null)?.ownerTab);
  const initials = user?.username?.slice(0, 2).toUpperCase() ?? "?";

  const go = (to: string) => {
    // The sheet's history entry becomes the pushed screen, so back returns
    // to the tab this was opened from.
    consume();
    onClose();
    navigate(to, { replace: true, state: { ownerTab } });
  };

  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={v => { if (!v) onClose(); }}
      isDismissable
      className={[o.overlay, o.sheetOverlay].join(" ")}
    >
      <Modal className={o.sheetModal}>
        <div className={[o.sheet, o.grouped].join(" ")} style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <Dialog className={o.dialog} aria-label="Account">
            <div className={o.grabber} aria-hidden="true" />
            <Heading slot="title" className="visually-hidden">Account</Heading>
            <div className={s.body}>
              <div className={s.profile}>
                <span className={s.bigAvatar}>{initials}</span>
                <div className={s.profileText}>
                  <span className={s.name}>{user?.username}</span>
                  <SessionLine />
                </div>
              </div>

              <ul className={s.group}>
                {items.map(item => (
                  <li key={item.to}>
                    <button type="button" className={s.item} onClick={() => go(item.to)}>
                      <IconTile icon={item.icon} color={item.icon === "shield" ? "var(--status-negative)" : item.icon === "terminal" ? "var(--series-7)" : "var(--label-secondary)"} />
                      <span className={s.itemLabel}>{item.label}</span>
                      <Icon name="chevronRight" size={16} weight="semibold" className={s.chevron} />
                    </button>
                  </li>
                ))}
              </ul>

              <ul className={s.group}>
                <li>
                  <button type="button" className={[s.item, s.signOut].join(" ")} onClick={() => { consume(); onClose(); signOut(); }}>
                    Sign Out
                  </button>
                </li>
              </ul>
            </div>
          </Dialog>
        </div>
      </Modal>
    </ModalOverlay>
  );
}
