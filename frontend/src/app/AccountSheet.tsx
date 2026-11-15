import { lazy, Suspense, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { getAuthToken } from "../api/client";
import s from "./AccountSheet.module.css";

const AccountSheet = /* @__PURE__ */ lazy(() => import("./AccountSheetDialog").then(m => ({ default: m.AccountSheet })));

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
  // The sheet loads on first open, so it is not part of the first download.
  const [loaded, setLoaded] = useState(false);
  const initials = user?.username?.slice(0, 2).toUpperCase() ?? "?";
  return (
    <>
      <button type="button" className={s.avatar} onClick={() => { setLoaded(true); setOpen(true); }} aria-label="Account" aria-haspopup="dialog">
        <span className={s.avatarCircle}>{initials}</span>
      </button>
      {loaded && (
        <Suspense fallback={null}>
          <AccountSheet isOpen={open} onClose={() => setOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
