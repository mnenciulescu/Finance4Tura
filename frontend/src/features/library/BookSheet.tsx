import { useId, useMemo, useState } from "react";
import { FieldRow, FormSheet, List, MonthField, Notice, Picker, Rating, TextField, useToast } from "../../ui";
import { useSaveBook } from "../../data/mutations";
import { useOnline } from "../../app/useOnline";
import type { Book } from "../../types";
import { SOURCES, TYPES } from "./libraryMath";
import f from "../money/forms/Forms.module.css";
import s from "./Library.module.css";

type Form = Omit<Book, "bookId" | "createdAt" | "updatedAt">;

const blank = (): Form => ({ name: "", source: "Book", type: "Book", author: "", title: "", dateCompleted: "", rating: null, comments: "" });
const fromBook = (b: Book): Form => ({
  name: b.name || "", source: b.source || "Book", type: b.type || "Book", author: b.author || "", title: b.title || "",
  dateCompleted: b.dateCompleted || "", rating: b.rating ?? null, comments: b.comments || "",
});

export function BookSheet({ target, names, onClose }: { target: { book?: Book; name?: string } | null; names: string[]; onClose: () => void }) {
  return <BookForm key={target ? target.book?.bookId ?? "new" : "closed"} target={target} names={names} onClose={onClose} />;
}

function BookForm({ target, names, onClose }: { target: { book?: Book; name?: string } | null; names: string[]; onClose: () => void }) {
  const book = target?.book;
  const prefillName = target?.name;
  const initial = useMemo(() => (book ? fromBook(book) : { ...blank(), name: prefillName ?? "" }), [book, prefillName]);
  const [form, setForm] = useState<Form>(initial);
  const [error, setError] = useState<string | null>(null);
  const save = useSaveBook();
  const toast = useToast();
  const online = useOnline();
  const listId = useId();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(p => ({ ...p, [k]: v }));

  const submit = async () => {
    setError(null);
    if (!form.title.trim()) { setError("Title is required"); return; }
    try {
      await save.mutateAsync({ id: book?.bookId, body: form });
      toast.show({ message: book ? "Entry saved" : "Entry added", tone: "positive" });
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || "Error saving");
    }
  };

  return (
    <FormSheet
      isOpen={!!target}
      onClose={onClose}
      title={book ? "Edit Entry" : "New Entry"}
      submitLabel={book ? "Save" : "Add"}
      onSubmit={submit}
      canSubmit={online}
      submitting={save.isPending}
      isDirty={JSON.stringify(form) !== JSON.stringify(initial)}
    >
      <div className={f.groups}>
        {error && <Notice>{error}</Notice>}
        <List aria-label="Entry">
          <FieldRow label="Person" htmlFor={`${listId}-person`}>
            <input
              id={`${listId}-person`}
              className={s.inlineInput}
              list={listId}
              value={form.name}
              placeholder="Who completed it"
              autoCapitalize="words"
              onChange={e => set("name", e.target.value)}
            />
            <datalist id={listId}>{names.map(n => <option key={n} value={n} />)}</datalist>
          </FieldRow>
          <TextField label="Title" value={form.title} onChange={v => set("title", v)} placeholder="Required" autoCapitalize="words" />
          <TextField label="Author" value={form.author} onChange={v => set("author", v)} placeholder="Optional" autoCapitalize="words" />
        </List>
        <List aria-label="Details">
          <Picker label="Type" value={form.type} options={TYPES.map(t => ({ value: t, label: t }))} onChange={v => set("type", v)} />
          <Picker label="Source" value={form.source} options={SOURCES.map(t => ({ value: t, label: t }))} onChange={v => set("source", v)} />
          <MonthField label="Completed" value={form.dateCompleted} onChange={v => set("dateCompleted", v)} />
          <FieldRow label="Rating">
            <Rating value={form.rating} onChange={v => set("rating", v)} />
          </FieldRow>
        </List>
        <List aria-label="Comments">
          <TextField label="Comments" value={form.comments} onChange={v => set("comments", v)} placeholder="Optional" multiline />
        </List>
      </div>
    </FormSheet>
  );
}
