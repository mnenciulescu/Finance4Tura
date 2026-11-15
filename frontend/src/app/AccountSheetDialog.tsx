import { useLocation, useNavigate } from "react-router-dom";
import { Dialog, Heading, Modal, ModalOverlay } from "react-aria-components";
import { useAuth } from "../context/AuthContext";
import { useAppSettings } from "../context/AppSettingsContext";
import { useOverlayHistory } from "./overlays";
import { ACCOUNT_ITEMS, tabForPath, visibleItems, type TabId } from "./navigation";
import { SessionLine } from "./AccountSheet";
import { Icon } from "../ui/icons/Icon";
import { IconTile } from "../ui/List";
import o from "../ui/Overlays.module.css";
import s from "./AccountSheet.module.css";

/**
 * The Account sheet: username, session countdown, Settings / Backstage /
 * Admin / One-Page, Sign Out. Loaded on the avatar's first tap.
 */
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
