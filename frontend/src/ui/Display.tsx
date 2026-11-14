import type { ReactNode, CSSProperties, HTMLAttributes } from "react";
import { Icon, type IconName } from "./icons/Icon";
import s from "./Display.module.css";

/* ── Card / Widget ────────────────────────────────────────────────────────── */

export function Card({ children, className, padded = true, ...rest }: HTMLAttributes<HTMLDivElement> & { padded?: boolean }) {
  return (
    <div className={[s.card, padded ? s.padded : "", className ?? ""].join(" ")} {...rest}>
      {children}
    </div>
  );
}

export interface WidgetProps {
  title: string;
  icon?: IconName;
  /** Trailing header content (e.g. a "See All ›" link or a reveal button). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Content runs edge to edge (lists) rather than padded. */
  flush?: boolean;
  id?: string;
}

/** A Today-screen widget: tinted icon + title header, then content. */
export function Widget({ title, icon, action, children, className, flush, id }: WidgetProps) {
  return (
    <section className={[s.widget, className ?? ""].join(" ")} aria-label={title} id={id}>
      <header className={s.widgetHead}>
        <h2 className={s.widgetTitle}>
          {icon && <Icon name={icon} size={18} weight="semibold" />}
          <span>{title}</span>
        </h2>
        {action && <div className={s.widgetAction}>{action}</div>}
      </header>
      <div className={flush ? s.widgetFlush : s.widgetBody}>{children}</div>
    </section>
  );
}

/* ── StatTile ─────────────────────────────────────────────────────────────── */

export function StatTile({
  value, caption, dot, tone, className, label,
}: { value: ReactNode; caption?: ReactNode; dot?: string; tone?: "positive" | "negative"; className?: string; label?: string }) {
  return (
    <div className={[s.stat, className ?? ""].join(" ")} aria-label={label} role={label ? "group" : undefined}>
      <span className={[s.statValue, tone ? s[`tone_${tone}`] : ""].join(" ")}>{value}</span>
      {caption && (
        <span className={s.statCaption}>
          {dot && <span className={s.dot} style={{ background: dot }} />}
          {caption}
        </span>
      )}
    </div>
  );
}

/* ── Badge / Dot ──────────────────────────────────────────────────────────── */

/** Small capsule: the colour as text over a 15 % tint of it. */
export function Badge({ children, color = "var(--tint)", className, solid }: { children: ReactNode; color?: string; className?: string; solid?: boolean }) {
  const style: CSSProperties = solid
    ? { background: color, color: "var(--on-tint)" }
    : { background: `color-mix(in srgb, ${color} 15%, transparent)`, color };
  return <span className={[s.badge, className ?? ""].join(" ")} style={style}>{children}</span>;
}

export function Dot({ color, size = 10, label }: { color: string; size?: number; label?: string }) {
  return (
    <span
      className={s.dot}
      style={{ background: color, width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      title={label}
    />
  );
}

/* ── ProgressBar / ProgressRing ───────────────────────────────────────────── */

export interface Segment { value: number; color: string; label?: string; }

/** Capsule track with proportional segments; zero-width segments are omitted. */
export function ProgressBar({ segments, height = 12, label, minFraction = 0 }: { segments: Segment[]; height?: number; label?: string; minFraction?: number }) {
  const shown = segments.filter(seg => seg.value > 0);
  const total = shown.reduce((sum, seg) => sum + seg.value, 0);
  return (
    <div className={s.track} style={{ height }} role="img" aria-label={label}>
      {total > 0 && shown.map((seg, i) => {
        const raw = seg.value / total;
        return (
          <span
            key={i}
            className={s.segment}
            style={{ flexGrow: Math.max(raw, minFraction), background: seg.color }}
            title={seg.label}
          />
        );
      })}
    </div>
  );
}

/** Ring showing done / total (Split coverage). */
export function ProgressRing({ done, total, size = 30, complete }: { done: number; total: number; size?: number; complete?: boolean }) {
  const r = (size - 4) / 2;
  const c = 2 * Math.PI * r;
  const pct = total > 0 ? Math.min(1, done / total) : 0;
  const color = complete ? "var(--status-positive)" : "var(--tint)";
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className={s.ring} role="img" aria-label={`${done} of ${total}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--fill)" strokeWidth="3.5" />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      {complete && <path d={`M${size * 0.32} ${size * 0.52} l${size * 0.12} ${size * 0.12} l${size * 0.24} -${size * 0.26}`} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

/* ── EmptyState / Skeleton / Notice ───────────────────────────────────────── */

export function EmptyState({ icon, title, message, action }: { icon?: IconName; title: string; message?: ReactNode; action?: ReactNode }) {
  return (
    <div className={s.empty}>
      {icon && <Icon name={icon} size={40} className={s.emptyIcon} />}
      <p className={s.emptyTitle}>{title}</p>
      {message && <p className={s.emptyMessage}>{message}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ height = 16, width = "100%", radius }: { height?: number | string; width?: number | string; radius?: string }) {
  return <span className={s.skeleton} style={{ height, width, borderRadius: radius }} aria-hidden="true" />;
}

/** Loading placeholder for a screen: a few skeleton blocks. */
export function ScreenSkeleton({ blocks = 3 }: { blocks?: number }) {
  return (
    <div className={s.screenSkeleton} aria-busy="true" aria-label="Loading">
      {Array.from({ length: blocks }, (_, i) => (
        <div key={i} className={s.skeletonCard}>
          <Skeleton height={14} width="40%" />
          <Skeleton height={20} width="80%" />
          <Skeleton height={20} width="65%" />
        </div>
      ))}
    </div>
  );
}

export function Notice({ tone = "negative", children, onDismiss }: { tone?: "negative" | "info"; children: ReactNode; onDismiss?: () => void }) {
  return (
    <div className={[s.notice, s[`notice_${tone}`]].join(" ")} role={tone === "negative" ? "alert" : "status"}>
      <Icon name={tone === "negative" ? "warning" : "info"} size={18} />
      <span className={s.noticeText}>{children}</span>
      {onDismiss && (
        <button type="button" className={s.noticeClose} onClick={onDismiss} aria-label="Dismiss">
          <Icon name="xmark" size={16} weight="semibold" />
        </button>
      )}
    </div>
  );
}
