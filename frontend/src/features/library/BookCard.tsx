import { Badge, Button, ContextMenu, Rating, SwipeActions } from "../../ui";
import { BOOK_TYPE_COLOR } from "../../theme/domainColors";
import type { Book } from "../../types";
import s from "./Library.module.css";

/**
 * One Library entry: title, author · source, type badge, inline rating and
 * month; tap expands the comments. Swipe or long-press for Edit / Delete.
 * Shared by the Library screen and One-Page.
 */
export function BookCard({
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
