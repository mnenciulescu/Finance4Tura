import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Icon, RevealScope, Sheet } from "../../ui";
// Preloads the desktop dialogs / row actions the shared components switch to.
import "../../ui/DeskOverlays";
import { useBooks } from "../../data/queries";
import { usePrivacy } from "../../context/PrivacyContext";
import { useOnline } from "../../app/useOnline";
import { openOverlayCount } from "../../app/overlays";
import { useForms } from "../money/forms/FormsContext";
import { SplitFormSheet } from "../money/split/SplitFormSheet";
import { OperationSheet } from "../money/invest/InvestForms";
import { BookSheet } from "../library/BookSheet";
import { NO_FILTERS, type Filters } from "../library/libraryMath";
import type { Book, Operation, SplitPayment } from "../../types";
import { Header } from "./Header";
import { MoneyMask } from "./Block";
import { BudgetBlock } from "./blocks/BudgetBlock";
import { SplitBlock } from "./blocks/SplitBlock";
import { PortfolioV2Block } from "./blocks/PortfolioV2Block";
import { BudgetStatsBlock, HqStatsBlock, LibraryStatsBlock } from "./blocks/StatsBlocks";
import { LibraryBlock } from "./blocks/LibraryBlock";
import { HqBlock } from "./blocks/HqBlock";
import { OnePageContext, PERIOD_EVENT, SEARCH_EVENT, sendCommand, useColumns, type BlockId, type Columns } from "./state";
import s from "./OnePage.module.css";

/**
 * One-Page (Documentation/OnePage_Desktop_Proposal.md): the Money, Library
 * and HQ tabs on one desktop screen. Four columns when they fit — Budget;
 * Portfolio v2 across columns 2–3 above HQ Statistics and HQ; Split + Library —
 * and the rightmost columns move below the others on narrower windows.
 */
export default function OnePage() {
  const qc = useQueryClient();
  const online = useOnline();
  const cols = useColumns();
  const [params, setParams] = useSearchParams();
  const { openExpense, openIncome } = useForms();
  const { incomeVisible, setIncomeVisible } = usePrivacy();
  const books = useBooks();

  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [split, setSplit] = useState<{ entry?: SplitPayment } | null>(null);
  const [book, setBook] = useState<{ book?: Book; name?: string } | null>(null);
  const [op, setOp] = useState<{ op?: Operation } | null>(null);
  const [shortcuts, setShortcuts] = useState(false);
  const [noteHidden, setNoteHidden] = useState(false);
  const [flash, setFlash] = useState<BlockId | null>(null);

  // Desktop type scale and page background (base.css, OnePage.module.css).
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-layout", "desk");
    document.title = "4TURA Home · One-Page";
    return () => {
      root.removeAttribute("data-layout");
      document.title = "4TURA Home";
    };
  }, []);

  // Deep links: ?expense=new|<id>&date=…, ?income=new|<id>. Consumed, so a
  // reload does not reopen the form.
  useEffect(() => {
    const exp = params.get("expense");
    const inc = params.get("income");
    if (!exp && !inc) return;
    const date = params.get("date") ?? undefined;
    setParams(prev => {
      const next = new URLSearchParams(prev);
      ["expense", "income", "date"].forEach(k => next.delete(k));
      return next;
    }, { replace: true });
    if (exp) openExpense({ id: exp === "new" ? undefined : exp, date });
    else if (inc) openIncome({ id: inc === "new" ? undefined : inc });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const flashTimer = useRef<number | undefined>(undefined);
  const settleTimer = useRef<number | undefined>(undefined);
  const focusBlock = useCallback((id: BlockId) => {
    const el = document.getElementById(`block-${id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
    // A layout change in the column (a block finishing loading) can cancel a
    // smooth scroll in WebKit; if it did not land, finish it instantly.
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const r = el?.getBoundingClientRect();
      if (el && r && (r.bottom < 0 || r.top > window.innerHeight)) el.scrollIntoView({ block: "start" });
    }, 700);
    setFlash(id);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(null), 1200);
  }, []);
  useEffect(() => () => { window.clearTimeout(flashTimer.current); window.clearTimeout(settleTimer.current); }, []);

  const ctx = useMemo(() => ({
    filters,
    setFilters,
    focusBlock,
    openSplit: setSplit,
    openBook: setBook,
    openOperation: setOp,
  }), [filters, focusBlock]);

  useShortcuts({
    expense: () => openExpense({}),
    income: () => openIncome({}),
    split: () => setSplit({}),
    book: () => setBook({}),
    operation: () => setOp({}),
    toggleIncome: () => setIncomeVisible(!incomeVisible),
    refresh: () => qc.invalidateQueries(),
    help: () => setShortcuts(true),
  });

  const names = useMemo(() => [...new Set((books.data ?? []).map(b => b.name).filter(Boolean))].sort(), [books.data]);

  const blocks: Record<BlockId, ReactNode> = {
    budget: <MoneyMask><BudgetBlock /></MoneyMask>,
    budgetStats: <MoneyMask><BudgetStatsBlock /></MoneyMask>,
    split: <SplitBlock />,
    portfolioV2: <PortfolioV2Block />,
    hqStats: <HqStatsBlock />,
    hq: <HqBlock />,
    libraryStats: <LibraryStatsBlock />,
    library: <LibraryBlock />,
  };
  const layout = LAYOUTS[cols];
  const renderBlock = (id: BlockId) => <div key={id} className={flash === id ? s.flash : undefined}>{blocks[id]}</div>;

  return (
    <OnePageContext.Provider value={ctx}>
      <RevealScope>
        <div className={s.page} data-cols={cols}>
          <Header onShortcuts={() => setShortcuts(true)} />
          {!online && (
            <div className={s.offline} role="status">
              <Icon name="wifiSlash" size={16} weight="semibold" />
              <span>Offline — showing saved data</span>
            </div>
          )}
          {cols === 1 && !noteHidden && (
            <div className={s.note} role="note">
              <span>One-Page is made for larger screens.</span>
              <a href="/" className={s.noteLink}>Open the app →</a>
              <button type="button" className={s.noteClose} aria-label="Dismiss" onClick={() => setNoteHidden(true)}>
                <Icon name="xmark" size={14} weight="semibold" />
              </button>
            </div>
          )}
          <main className={s.grid} data-cols={cols}>
            {layout.map((item, i) => {
              const label = `Column ${regionNumber(layout, i)}`;
              const scrollable = cols >= 3 ? 0 : undefined;
              if (Array.isArray(item)) {
                return (
                  <div key={i} className={s.col} role="region" aria-label={label} tabIndex={scrollable}>
                    {item.map(renderBlock)}
                  </div>
                );
              }
              const end = regionNumber(layout, i) + item.below.length - 1;
              return (
                <div
                  key={i} className={s.col} role="region" tabIndex={scrollable}
                  aria-label={`Columns ${regionNumber(layout, i)}–${end}`} style={{ gridColumn: `span ${item.below.length}` }}
                >
                  {item.top.map(renderBlock)}
                  <div className={s.subgrid} style={{ gridTemplateColumns: item.below.map(() => "minmax(0, 1fr)").join(" ") }}>
                    {item.below.map((column, j) => (
                      <div key={j} className={s.subcol} data-subcol={j + 1}>{column.map(renderBlock)}</div>
                    ))}
                  </div>
                </div>
              );
            })}
          </main>
        </div>

        <SplitFormSheet target={split} onClose={() => setSplit(null)} />
        <BookSheet target={book} names={names} onClose={() => setBook(null)} />
        <OperationSheet target={op} onClose={() => setOp(null)} />
        <ShortcutsSheet isOpen={shortcuts} onClose={() => setShortcuts(false)} />
      </RevealScope>
    </OnePageContext.Provider>
  );
}

/* ── Columns ──────────────────────────────────────────────────────────────── */

/**
 * A plain column, or a region spanning several grid columns: blocks across
 * its full width on top, then one sub-column per spanned column below. The
 * whole region scrolls as one.
 */
type LayoutItem = BlockId[] | { top: BlockId[]; below: BlockId[][] };

const COLUMN_1: BlockId[] = ["budget", "budgetStats"];
const COLUMN_2: BlockId[] = ["hqStats"];
const COLUMN_3: BlockId[] = ["hq"];
const COLUMN_4: BlockId[] = ["split", "libraryStats", "library"];
const WIDE: BlockId[] = ["portfolioV2"];

/** Portfolio v2 spans columns 2–3; with fewer columns the rightmost ones move below the others. */
const LAYOUTS: Record<Columns, LayoutItem[]> = {
  4: [COLUMN_1, { top: WIDE, below: [COLUMN_2, COLUMN_3] }, COLUMN_4],
  3: [COLUMN_1, { top: WIDE, below: [[...COLUMN_2, ...COLUMN_3], COLUMN_4] }],
  2: [{ top: WIDE, below: [[...COLUMN_1, ...COLUMN_2], [...COLUMN_4, ...COLUMN_3]] }],
  1: [[...COLUMN_1, ...WIDE, ...COLUMN_2, ...COLUMN_3, ...COLUMN_4]],
};

/** The number of the first grid column an item starts at. */
function regionNumber(layout: LayoutItem[], index: number) {
  return 1 + layout.slice(0, index).reduce((n, item) => n + (Array.isArray(item) ? 1 : item.below.length), 0);
}

/* ── Keyboard shortcuts (§6.4) ────────────────────────────────────────────── */

const NEW_KEYS = { e: "expense", i: "income", s: "split", b: "book", o: "operation" } as const;

interface ShortcutActions {
  expense: () => void; income: () => void; split: () => void; book: () => void; operation: () => void;
  toggleIncome: () => void; refresh: () => void; help: () => void;
}

function useShortcuts(actions: ShortcutActions) {
  const ref = useRef(actions);
  ref.current = actions;
  useEffect(() => {
    let prefixAt = 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const target = e.target instanceof Element ? e.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (openOverlayCount() > 0) return;
      const a = ref.current;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;

      if (Date.now() - prefixAt < 1500) {
        prefixAt = 0;
        const name = NEW_KEYS[key as keyof typeof NEW_KEYS];
        if (name) { e.preventDefault(); a[name](); }
        return;
      }
      // Arrows only when nothing that uses them has focus.
      const free = !target || target === document.body || !target.closest("[role='tablist'], [role='radiogroup'], [role='menu'], [role='slider'], [role='grid']");
      switch (key) {
        case "n": prefixAt = Date.now(); break;
        case "ArrowLeft": if (free) { e.preventDefault(); sendCommand(PERIOD_EVENT, -1); } break;
        case "ArrowRight": if (free) { e.preventDefault(); sendCommand(PERIOD_EVENT, 1); } break;
        case "t": sendCommand(PERIOD_EVENT, 0); break;
        case "/": e.preventDefault(); sendCommand(SEARCH_EVENT); break;
        case "h": a.toggleIncome(); break;
        case "r": a.refresh(); break;
        case "?": a.help(); break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

const SHORTCUTS: [string, string][] = [
  ["N then E", "New expense"],
  ["N then I", "New income"],
  ["N then S", "New split payment"],
  ["N then O", "New operation"],
  ["N then B", "New library entry"],
  ["← / →", "Previous / next budget period"],
  ["T", "Current budget period"],
  ["/", "Search the library"],
  ["H", "Show / hide money amounts (Budget)"],
  ["R", "Refresh"],
  ["Esc", "Close the dialog or menu"],
  ["Space on 👁", "Show / hide investment amounts"],
  ["?", "This list"],
];

function ShortcutsSheet({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <Sheet isOpen={isOpen} onClose={onClose} title="Keyboard Shortcuts">
      <dl className={s.shortcuts}>
        {SHORTCUTS.map(([k, v]) => (
          <div key={k} className={s.shortcut}>
            <dt><kbd className={s.kbd}>{k}</kbd></dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
    </Sheet>
  );
}
