import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "../ui/icons/Icon";
import { AccountButton } from "./AccountSheet";
import { usePullToRefresh } from "./usePullToRefresh";
import s from "./Screen.module.css";

export interface ScreenProps {
  title: string;
  /** Root screens show a 34 pt large title that collapses on scroll. */
  large?: boolean;
  /** Small text under the large title (e.g. today's date, counts). */
  subtitle?: ReactNode;
  /** Trailing nav-bar actions (icons, menus). The account avatar is added on root screens. */
  actions?: ReactNode;
  /** Sticky row under the title: segmented control, search field. */
  accessory?: ReactNode;
  /** Pushed screens: back button label (previous screen's title). */
  back?: { label: string; to: string };
  /** Hide the account avatar (pushed screens hide it automatically). */
  hideAccount?: boolean;
  /** Enables pull-to-refresh. */
  onRefresh?: () => Promise<unknown> | void;
  children: ReactNode;
}

/**
 * A screen with an iOS navigation bar (proposal §6.2).
 *
 * The bar is transparent over the large title; once the title scrolls under
 * it, the bar turns to translucent material, shows its hairline and fades in
 * the inline title. Pushed screens use the compact bar from the start.
 */
export function Screen({ title, large = true, subtitle, actions, accessory, back, hideAccount, onRefresh, children }: ScreenProps) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(!large);
  const navigate = useNavigate();
  const location = useLocation();
  const pull = usePullToRefresh(onRefresh);

  useEffect(() => {
    if (!large) return;
    const el = sentinel.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setCollapsed(!entry.isIntersecting),
      { rootMargin: "-44px 0px 0px 0px", threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [large]);

  const goBack = () => {
    if (!back) return;
    // Pop when this screen was pushed in-app; otherwise land on the parent.
    if (location.key !== "default" && window.history.length > 1) navigate(-1);
    else navigate(back.to, { replace: true });
  };

  const showAccount = !back && !hideAccount;

  return (
    <div className={s.screen}>
      <header className={[s.bar, collapsed ? s.barCollapsed : ""].join(" ")}>
        <div className={s.barRow}>
          <div className={s.barLeading}>
            {back && (
              <button type="button" className={s.back} onClick={goBack} aria-label={`Back to ${back.label}`}>
                <Icon name="chevronLeft" size={26} weight="semibold" />
                <span className={s.backLabel}>{back.label}</span>
              </button>
            )}
          </div>
          <h1 className={[s.inlineTitle, collapsed ? s.inlineShown : ""].join(" ")} aria-hidden={large && !collapsed}>
            {title}
          </h1>
          <div className={s.barTrailing}>
            {actions}
            {showAccount && <AccountButton />}
          </div>
        </div>
      </header>

      {pull.indicator}

      {large && (
        <div className={s.largeTitleWrap} ref={sentinel}>
          <h1 className={s.largeTitle}>{title}</h1>
          {subtitle && <p className={s.subtitle}>{subtitle}</p>}
        </div>
      )}

      {accessory && <div className={[s.accessory, collapsed ? s.accessoryStuck : ""].join(" ")}>{accessory}</div>}

      <main className={s.content} {...pull.bind}>{children}</main>
    </div>
  );
}
