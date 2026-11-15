import { useMemo, useRef, useState } from "react";
import { ActionSheet, Button, EmptyState, Icon, IconButton, Notice, SearchField, ShowMore, Skeleton, useShowMore, useToast } from "../../../ui";
import { useBooks } from "../../../data/queries";
import { useDeleteBook, useRateBook } from "../../../data/mutations";
import type { Book } from "../../../types";
import { applyFilters, NO_FILTERS, sectionsOf } from "../../library/libraryMath";
import { BookCard } from "../../library/BookCard";
import { FilterSheet } from "../../library/FilterSheet";
import { Block, ChipTabs, LinkButton } from "../Block";
import { SEARCH_EVENT, useCommand, useOnePage, useParam } from "../state";
import l from "../../library/Library.module.css";
import s from "../OnePage.module.css";

const ALL = "__all__";

/**
 * Library (One-Page §7.5): search and filters, one tab per person (plus All),
 * 3 entries then Show More. The 12-month chart is the Library Statistics block.
 */
export function LibraryBlock() {
  const books = useBooks();
  const rate = useRateBook();
  const del = useDeleteBook();
  const toast = useToast();
  const { filters, setFilters, openBook, focusBlock } = useOnePage();
  const [person, setPerson] = useParam("lib", ALL);
  const [filterOpen, setFilterOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [toDelete, setToDelete] = useState<Book | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // "/" from the page's keyboard shortcuts.
  useCommand(SEARCH_EVENT, () => searchRef.current?.querySelector("input")?.focus());

  const all = useMemo(() => books.data ?? [], [books.data]);
  const filtered = useMemo(() => applyFilters(all, filters), [all, filters]);
  const sections = useMemo(() => sectionsOf(filtered), [filtered]);
  const names = useMemo(() => [...new Set(all.map(b => b.name).filter(Boolean))].sort(), [all]);
  const section = sections.find(sec => sec.person === person);
  const tab = section ? person : ALL;
  const items = useMemo(
    () => section?.items ?? [...filtered].sort((a, b) => (b.dateCompleted || "").localeCompare(a.dateCompleted || "") || (a.title || "").localeCompare(b.title || "")),
    [section, filtered],
  );
  const monthly = section ? section.monthly : null;
  const yearCount = (monthly ?? sections.flatMap(sec => sec.monthly)).reduce((t, m) => t + m.count, 0);
  const [limit, setLimit] = useShowMore(3, `${tab}-${JSON.stringify(filters)}`);
  const sheetFilters = [filters.name, filters.source, filters.type, filters.rating].filter(Boolean).length;
  const anyFilter = Object.values(filters).some(Boolean);

  const doDelete = (book: Book) => {
    setToDelete(null);
    del.mutate(book.bookId, {
      onSuccess: () => toast.show({ message: "Entry deleted", icon: "trash" }),
      onError: () => toast.show({ message: "Could not delete the entry.", tone: "negative" }),
    });
  };

  return (
    <Block
      id="library"
      title="Library"
      subtitle={books.data && (
        <>
          {sections.length} {sections.length === 1 ? "person" : "people"} · {filtered.length} of {all.length}
          {anyFilter && <button type="button" className={l.clear} onClick={() => setFilters(NO_FILTERS)}>Clear</button>}
        </>
      )}
      actions={<IconButton icon="plus" label="New entry" onClick={() => openBook({ name: section?.person })} />}
      toolbar={
        <div className={s.searchRow} ref={searchRef}>
          <SearchField label="Search title or author" placeholder="Search title or author" value={filters.search} onChange={v => setFilters(f => ({ ...f, search: v }))} />
          <button
            type="button"
            className={[l.filterBtn, sheetFilters ? l.filterOn : ""].join(" ")}
            onClick={() => setFilterOpen(true)}
            aria-label={sheetFilters ? `Filters, ${sheetFilters} active` : "Filters"}
          >
            <Icon name="filter" size={18} weight="semibold" />
            Filter
            {sheetFilters > 0 && <span className={l.filterCount}>{sheetFilters}</span>}
          </button>
        </div>
      }
      tabs={sections.length > 0 && (
        <ChipTabs
          label="People"
          value={tab}
          onChange={v => setPerson(v)}
          options={[{ value: ALL, label: `All · ${filtered.length}` }, ...sections.map(sec => ({ value: sec.person, label: `${sec.person} · ${sec.items.length}` }))]}
        />
      )}
    >
      {books.isError && <Notice>Could not load the library.</Notice>}
      {books.isPending ? (
        <Skeleton height={200} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="library"
          title={all.length === 0 ? "No entries yet" : "No entries found"}
          message={all.length === 0 ? "Track the books, audiobooks and trainings each person completes." : "Try clearing some filters."}
          action={all.length === 0
            ? <Button variant="tinted" icon="plus" onClick={() => openBook({})}>Add Entry</Button>
            : <Button variant="tinted" onClick={() => setFilters(NO_FILTERS)}>Clear Filters</Button>}
        />
      ) : (
        <>
          <div className={s.captionRow}>
            <p className={s.caption}>Last 12 months: <strong>{yearCount}</strong> completed</p>
            <LinkButton onClick={() => focusBlock("libraryStats")}>Chart →</LinkButton>
          </div>
          <div className={s.stack}>
            {items.slice(0, limit).map(b => (
              <BookCard
                key={b.bookId}
                book={b}
                open={!!expanded[b.bookId]}
                onToggle={() => setExpanded(m => ({ ...m, [b.bookId]: !m[b.bookId] }))}
                onRate={r => rate.mutate({ book: b, rating: r })}
                onEdit={() => openBook({ book: b })}
                onDelete={() => doDelete(b)}
                onRequestDelete={() => setToDelete(b)}
              />
            ))}
          </div>
          <ShowMore shown={limit} total={items.length} initial={3} step={5} onChange={setLimit} allowAll />
        </>
      )}

      <FilterSheet isOpen={filterOpen} onClose={() => setFilterOpen(false)} filters={filters} names={names} onChange={setFilters} />
      <ActionSheet
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        title={`Delete “${toDelete?.title}”?`}
        message="This cannot be undone."
        actions={[{ label: "Delete Entry", destructive: true, onAction: () => toDelete && doDelete(toDelete) }]}
      />
    </Block>
  );
}
