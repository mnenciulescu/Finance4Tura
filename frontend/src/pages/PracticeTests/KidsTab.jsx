import { useState } from "react";
import { putKids } from "../../api/practiceTests";
import s from "./styles";

export default function KidsTab({ kids, setKids }) {
  const [list, setList]     = useState(kids.map(k => ({ ...k })));
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState(null);
  const [saved, setSaved]   = useState(false);

  function addKid()        { if (list.length < 20) setList(l => [...l, { kidId: "", name: "", order: l.length }]); }
  function removeKid(i)    { setList(l => l.filter((_, idx) => idx !== i)); }
  function setName(i, val) { setList(l => l.map((k, idx) => idx === i ? { ...k, name: val } : k)); setSaved(false); }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await putKids({ kids: list.map((k, i) => ({ ...k, order: i })) });
      setKids(res.kids || []);
      setList(res.kids || []);
      setSaved(true);
    } catch (e) {
      setError(e?.response?.data?.message || e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={s.tabContent}>
      <div style={s.toolbar}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {saved && <span style={{ fontSize: "12px", color: "var(--badge-text)" }}>Saved ✓</span>}
          <button style={s.btnSm} onClick={addKid} disabled={list.length >= 20}>+ Add Kid</button>
          <button style={s.btnPrimary} onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {error && <div style={s.formError}>{error}</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxWidth: "400px" }}>
        {list.length === 0 && (
          <div style={s.empty}>No kids yet. Add one to get started.</div>
        )}
        {list.map((k, i) => (
          <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", width: "20px", textAlign: "right", flexShrink: 0 }}>{i + 1}.</span>
            <input
              style={{ ...s.input, flex: 1 }}
              value={k.name}
              onChange={e => setName(i, e.target.value)}
              placeholder={`Kid ${i + 1} name`}
            />
            <button style={{ ...s.btnIcon, color: "var(--danger)" }} onClick={() => { if (window.confirm(`Remove "${k.name || `Kid ${i + 1}`}"?`)) { removeKid(i); setSaved(false); } }}>✕</button>
          </div>
        ))}
      </div>
    </div>
  );
}
