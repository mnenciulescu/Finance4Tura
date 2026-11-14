import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Icon, type IconName } from "./icons/Icon";
import s from "./Toast.module.css";

export interface ToastOptions {
  message: string;
  tone?: "neutral" | "positive" | "negative";
  icon?: IconName;
  /** Optional action button, e.g. "Reload" or "Undo". */
  action?: { label: string; onAction: () => void };
  /** ms; 0 keeps it until dismissed. Default 3000. */
  duration?: number;
}

interface ToastItem extends ToastOptions { id: number; }

interface ToastContextValue {
  show: (t: ToastOptions | string) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue>({ show: () => 0, dismiss: () => {} });

/** Top-of-screen capsule toasts for non-blocking results (role="status"). */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<number, number>());
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems(list => list.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
  }, []);

  const show = useCallback((t: ToastOptions | string) => {
    const opts: ToastOptions = typeof t === "string" ? { message: t } : t;
    const id = nextId.current++;
    setItems(list => [...list.filter(x => x.message !== opts.message), { ...opts, id }].slice(-3));
    const duration = opts.duration ?? 3000;
    if (duration > 0) timers.current.set(id, window.setTimeout(() => dismiss(id), duration));
    return id;
  }, [dismiss]);

  useEffect(() => () => timers.current.forEach(t => window.clearTimeout(t)), []);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={s.region} role="status" aria-live="polite">
        {items.map(t => (
            <div key={t.id} className={[s.toast, s[t.tone ?? "neutral"]].join(" ")}>
              {(t.icon || t.tone === "negative" || t.tone === "positive") && (
                <Icon name={t.icon ?? (t.tone === "negative" ? "warning" : "checkCircle")} size={18} weight="semibold" className={s.icon} />
              )}
              <span className={s.message}>{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  className={s.action}
                  onClick={() => { t.action?.onAction(); dismiss(t.id); }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
          ))}
      </div>
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => useContext(ToastContext);
