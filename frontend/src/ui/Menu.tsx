import { useRef, useState, type ReactNode, type RefObject } from "react";
import {
  Button as AriaButton, Menu as AriaMenu, MenuItem, MenuTrigger, Popover, Separator,
} from "react-aria-components";
import { useLongPress } from "react-aria";
import { useOverlayHistory } from "../app/overlays";
import { haptic } from "../app/haptics";
import { Icon, type IconName } from "./icons/Icon";
import s from "./Overlays.module.css";
import b from "./Button.module.css";

export type MenuEntry =
  | {
      id: string;
      label: string;
      icon?: IconName;
      destructive?: boolean;
      disabled?: boolean;
      /** Shows a checkmark (e.g. the selected year). */
      selected?: boolean;
      onAction: () => void;
    }
  | { separator: true; id: string };

function MenuItems({ items, label, onClose }: { items: MenuEntry[]; label: string; onClose: () => void }) {
  return (
    <AriaMenu
      aria-label={label}
      className={s.menu}
      onAction={key => {
        const item = items.find(i => i.id === key);
        if (item && !("separator" in item)) {
          onClose();
          item.onAction();
        }
      }}
      disabledKeys={items.filter(i => !("separator" in i) && i.disabled).map(i => i.id)}
    >
      {items.map(item =>
        "separator" in item ? (
          <Separator key={item.id} className={s.menuSeparator} />
        ) : (
          <MenuItem
            key={item.id}
            id={item.id}
            textValue={item.label}
            className={[s.menuItem, item.destructive ? s.menuDestructive : ""].join(" ")}
          >
            <span className={s.menuCheck} aria-hidden="true">
              {item.selected && <Icon name="check" size={16} weight="semibold" />}
            </span>
            <span className={s.menuLabel}>{item.label}</span>
            {item.icon && <Icon name={item.icon} size={20} />}
          </MenuItem>
        ),
      )}
    </AriaMenu>
  );
}

export interface PullDownMenuProps {
  /** Accessible name of the trigger and the menu. */
  label: string;
  icon?: IconName;
  /** Visible trigger text (e.g. "2026"); icon-only when omitted. */
  text?: ReactNode;
  items: MenuEntry[];
  /** Trigger look: icon circle (nav bar) or plain text button. */
  appearance?: "icon" | "text" | "circle";
  placement?: "bottom end" | "bottom start" | "bottom";
}

/** A pull-down menu anchored to a button (nav-bar +, year picker, ··· menus). */
export function PullDownMenu({ label, icon = "ellipsisCircle", text, items, appearance = "icon", placement = "bottom end" }: PullDownMenuProps) {
  const [open, setOpen] = useState(false);
  useOverlayHistory(open, () => setOpen(false));
  return (
    <MenuTrigger isOpen={open} onOpenChange={setOpen}>
      <AriaButton
        aria-label={label}
        className={[
          b.iconButton,
          appearance === "circle" ? b.icon_circle : "",
          appearance === "text" ? s.menuTextTrigger : "",
        ].join(" ")}
      >
        {text != null ? (
          <span className={s.menuTriggerText}>
            {text}
            <Icon name="chevronDown" size={14} weight="semibold" />
          </span>
        ) : (
          <span className={b.iconInner}><Icon name={icon} size={22} weight="semibold" /></span>
        )}
      </AriaButton>
      <Popover placement={placement} offset={4} className={s.popover}>
        <MenuItems items={items} label={label} onClose={() => setOpen(false)} />
      </Popover>
    </MenuTrigger>
  );
}

export interface ContextMenuProps {
  label: string;
  items: MenuEntry[];
  children: ReactNode;
  className?: string;
  /** Disable while e.g. a swipe is in progress. */
  disabled?: boolean;
}

/**
 * Long-press (touch) or right-click (pointer) context menu around any content.
 * The platform's own long-press callout and text selection are suppressed so
 * only the app's menu appears, on iPhone and Android alike.
 */
export function ContextMenu({ label, items, children, className, disabled }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  useOverlayHistory(open, () => setOpen(false));

  const { longPressProps } = useLongPress({
    isDisabled: disabled,
    accessibilityDescription: "Long press for more actions",
    onLongPress: () => {
      haptic("light");
      setOpen(true);
    },
  });

  return (
    <>
      <div
        ref={ref}
        className={[s.contextTarget, open ? s.contextActive : "", className ?? ""].join(" ")}
        {...longPressProps}
        onContextMenu={e => {
          e.preventDefault();
          if (!disabled) setOpen(true);
        }}
      >
        {children}
      </div>
      <Popover
        triggerRef={ref as RefObject<Element>}
        isOpen={open}
        onOpenChange={setOpen}
        placement="bottom"
        offset={6}
        className={s.popover}
      >
        <MenuItems items={items} label={label} onClose={() => setOpen(false)} />
      </Popover>
    </>
  );
}
