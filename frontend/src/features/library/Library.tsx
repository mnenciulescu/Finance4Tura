import { lazy, Suspense, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Screen } from "../../app/Screen";
import {
  ActionSheet, Badge, Button, ContextMenu, EmptyState, Icon, IconButton, ListSection, Notice, Rating, ScreenSkeleton,
  SearchField, Skeleton, SwipeActions, useToast,
} from "../../ui";
import { keys, useBooks } from "../../data/queries";
import { useDeleteBook, useRateBook } from "../../data/mutations";
import { BOOK_TYPE_COLOR } from "../../theme/domainColors";
import type { Book } from "../../types";
import { applyFilters, NO_FILTERS, PAGE, previousReveal, sectionsOf, STATS_MONTHS, type Filters } from "./libraryMath";
import { FilterSheet } from "./FilterSheet";
import { BookSheet } from "./BookSheet";
import s from "./Library.module.css";

const MonthlyChart = lazy(() => import("./MonthlyChart"));

/** Library — Books & Development (proposal §8.8). */
export default function Library() {
  const qc = useQueryClient();
  const books = useBooks();
  const rate = useRateBook();
  const del = useDeleteBook();
  const toast = useToast();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [filterOpen, setFilterOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [shown, setShown] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [form, setForm] = useState<{ book?: Book } | null>(null);
  const [toDelete, setToDelete] = useState<Book | null>(null);

  const all = useMemo(() => books.data ?? [], [books.data]);
  const filtered = useMemo(() => applyFilters(all, filters), [all, filters]);
  const sections = useMemo(() => sectionsOf(filtered), [filtered]);
  const names = useMemo(() => [...new Set(all.map(b => b.name).filter(Boolean))].sort(), [all]);
  const activeFilters = Object.values(filters).filter(Boolean).length;
  const sheetFilters = [filters.name, filters.source, filters.type, filters.rating].filter(Boolean).length;

  const doDelete = (book: Book) => {
    setToDelete(null);
    del.mutate(book.bookId, {
      onSuccess: () => toast.show({ message: "Entry deleted", icon: "trash" }),
      onError: () => toast.show({ message: "Could not delete the entry.", tone: "negative" }),
    });
  };

  return (
    <Screen
      title="Library"
      subtitle={books.isPending ? undefined : (
        <>
          {sections.length} {sections.length === 1 ? "person" : "people"} · {filtered.length} of {all.length} entr{all.length === 1 ? "y" : "ies"}
          {activeFilters > 0 && (
            <button type="button" className={s.clear} onClick={() => setFilters(NO_FILTERS)}>Clear</button>
          )}
        </>
      )}
      onRefresh={() => qc.invalidateQueries({ queryKey: keys.books })}
      actions={<IconButton icon="plus" label="New entry" onClick={() => setForm({})} />}
      accessory={
        <div className={s.searchRow}>
          <SearchField label="Search title or author" placeholder="Search title or author" value={filters.search} onChange={v => setFilters(f => ({ ...f, search: v }))} />
          <button
            type="button"
            className={[s.filterBtn, sheetFilters ? s.filterOn : ""].join(" ")}
            onClick={() => setFilterOpen(true)}
            aria-label={sheetFilters ? `Filters, ${sheetFilters} active` : "Filters"}
          >
            <Icon name="filter" size={18} weight="semibold" />
            Filter
            {sheetFilters > 0 && <span className={s.filterCount}>{sheetFilters}</span>}
          </button>
        </div>
      }
    >
      {books.isError && <Notice>Could not load the library.</Notice>}
      {books.isPending ? (
        <ScreenSkeleton blocks={3} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="library"
          title={all.length === 0 ? "No entries yet" : "No entries found"}
          message={all.length === 0 ? "Track the books, audiobooks and trainings each person completes." : "Try clearing some filters."}
          action={all.length === 0
            ? <Button variant="tinted" icon="plus" onClick={() => setForm({})}>Add Entry</Button>
            : <Button variant="tinted" onClick={() => setFilters(NO_FILTERS)}>Clear Filters</Button>}
        />
      ) : (
        sections.map(({ person, items, monthly }) => {
          const visibleCount = Math.min(items.length, shown[person] ?? 1);
          const visible = items.slice(0, visibleCount);
          const left = items.length - visible.length;
          const prev = previousReveal(visible.length);
          const total = monthly.reduce((sum, m) => sum + m.count, 0);
          return (
            <ListSection
              key={person}
              id={`person-${person}`}
              header={<>{person} <span className={s.count}>({items.length})</span></>}
              collapsible
              open={!collapsed[person]}
              onOpenChange={o => setCollapsed(m => ({ ...m, [person]: !o }))}
            >
              <div className={s.personBody} data-person={person}>
                <div className={s.chartCard} data-chart="monthly" data-counts={monthly.map(m => m.count).join(",")}>
                  <div className={s.chartHead}>
                    <span className={s.chartLabel}>Last {STATS_MONTHS} months</span>
                    <span className={s.chartTotal}><span data-stat="count">{total}</span> completed</span>
                  </div>
                  <Suspense fallback={<Skeleton height={110} />}>
                    <MonthlyChart data={monthly} person={person} />
                  </Suspense>
                </div>

                {visible.map(b => (
                  <BookCard
                    key={b.bookId}
                    book={b}
                    open={!!expanded[b.bookId]}
                    onToggle={() => setExpanded(m => ({ ...m, [b.bookId]: !m[b.bookId] }))}
                    onRate={r => rate.mutate({ book: b, rating: r })}
                    onEdit={() => setForm({ book: b })}
                    onDelete={() => doDelete(b)}
                    onRequestDelete={() => setToDelete(b)}
                  />
                ))}

                {(left > 0 || visible.length > 1) && (
                  <div className={s.moreRow}>
                    {visible.length > 1 && (
                      <Button variant="gray" size="medium" onClick={() => setShown(m => ({ ...m, [person]: prev }))}>
                        Show {visible.length - prev} Less
                      </Button>
                    )}
                    {left > 0 && (
                      <Button variant="gray" size="medium" onClick={() => setShown(m => ({ ...m, [person]: visible.length + PAGE }))}>
                        Show {Math.min(PAGE, left)} More <span className={s.moreCount}>{visible.length}/{items.length}</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </ListSection>
          );
        })
      )}

      <FilterSheet
        isOpen={filterOpen}
        onClose={() => setFilterOpen(false)}
        filters={filters}
        names={names}
        onChange={setFilters}
      />
      <BookSheet target={form} names={names} onClose={() => setForm(null)} />
      <ActionSheet
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Delete “${toDelete?.title}”?`}
        message="This cannot be undone."
        actions={[{ label: "Delete Entry", destructive: true, onAction: () => toDelete && doDelete(toDelete) }]}
      />
    </Screen>
  );
}

function BookCard({
  book, open, onToggle, onRate, onEdit, onDelete, onRequestDelete,
}: {
  book: Book; open: boolean; onToggle: () => void; onRate: (r: number | null) => void;
  onEdit: () => void; onDelete: () => void; onRequestDelete: () => void;
}) {
  const color = BOOK_TYPE_COLOR[book.type] ?? BOOK_TYPE_COLOR.Other;
  return (
    <article className={s.card} data-book={book.bookId}>
      <SwipeActions
        actions={[
          { label: "Edit", icon: "pencil", onAction: onEdit },
          { label: "Delete", icon: "trash", destructive: true, onAction: onDelete },
        ]}
      >
        <ContextMenu
          label={`Actions for ${book.title}`}
          items={[
            { id: "edit", label: "Edit", icon: "pencil", onAction: onEdit },
            { id: "delete", label: "Delete", icon: "trash", destructive: true, onAction: onRequestDelete },
          ]}
        >
          <div className={s.cardInner}>
            <button type="button" className={s.cardHead} onClick={onToggle} aria-expanded={open}>
              <span className={s.cardTitle}>{book.title}</span>
              {(book.author || book.source) && (
                <span className={s.cardSub}>{[book.author, book.source].filter(Boolean).join(" · ")}</span>
              )}
            </button>
            <div className={s.cardMeta}>
              <Badge color={color}>{book.type || "—"}</Badge>
              <Rating value={book.rating} onChange={onRate} size={18} label={`Rating for ${book.title}`} />
              <span className={s.flex} />
              <span className={s.cardDate}>{book.dateCompleted || "—"}</span>
            </div>
            {open && (
              <div className={s.cardBody}>
                {book.comments ? <p className={s.comments}>{book.comments}</p> : <p className={s.noComments}>No comments.</p>}
                <div className={s.cardActions}>
                  <Button variant="gray" size="small" icon="pencil" onClick={onEdit}>Edit</Button>
                  <Button variant="destructiveTinted" size="small" icon="trash" onClick={onRequestDelete}>Delete</Button>
                </div>
              </div>
            )}
          </div>
        </ContextMenu>
      </SwipeActions>
    </article>
  );
}
