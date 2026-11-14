import { ContextMenu, SwipeActions, type MenuEntry } from "../../../ui";
import type { Expense } from "../../../types";
import { ExpenseRow } from "./ExpenseRow";

export interface EditableExpenseRowProps {
  exp: Expense;
  onToggle: (exp: Expense) => void;
  onEdit: (exp: Expense) => void;
  /** Swipe Delete, already confirmed by its two-step. */
  onDelete: (exp: Expense) => void;
  /** Context-menu Delete, which still needs a confirmation. */
  onRequestDelete: (exp: Expense) => void;
}

/** Budget's expense row: swipe for Edit / Delete, long-press for the menu. */
export function EditableExpenseRow({ exp, onToggle, onEdit, onDelete, onRequestDelete }: EditableExpenseRowProps) {
  const done = exp.status === "Completed";
  const menu: MenuEntry[] = [
    { id: "edit", label: "Edit", icon: "pencil", onAction: () => onEdit(exp) },
    { id: "toggle", label: done ? "Mark as Pending" : "Mark as Completed", icon: done ? "undo" : "checkCircle", onAction: () => onToggle(exp) },
    { id: "delete", label: "Delete", icon: "trash", destructive: true, onAction: () => onRequestDelete(exp) },
  ];
  return (
    <SwipeActions
      actions={[
        { label: "Edit", icon: "pencil", onAction: () => onEdit(exp) },
        { label: "Delete", icon: "trash", destructive: true, onAction: () => onDelete(exp) },
      ]}
    >
      <ContextMenu label={`Actions for ${exp.summary}`} items={menu}>
        <ExpenseRow exp={exp} onToggle={onToggle} onEdit={onEdit} />
      </ContextMenu>
    </SwipeActions>
  );
}
