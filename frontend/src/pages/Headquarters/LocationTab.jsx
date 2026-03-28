import { useState } from "react";
import EntryTable from "./EntryTable";
import s from "./styles";

export default function LocationTab({ hqId, templates, entries, onEntryCreated, onEntryUpdated, onEntryDeleted }) {
  const locationTemplates = templates.filter(t => t.hqId === hqId);

  if (locationTemplates.length === 0) {
    return (
      <div style={s.tabContent}>
        <div style={s.empty}>No tracker templates for this location. Add one in Settings.</div>
      </div>
    );
  }

  return (
    <div style={s.tabContent}>
      {locationTemplates.map(tpl => {
        const tplEntries = entries
          .filter(e => e.templateId === tpl.templateId)
          .sort((a, b) => {
            const d = b.date.localeCompare(a.date);
            return d !== 0 ? d : b.createdAt.localeCompare(a.createdAt);
          });
        return (
          <TemplateSection
            key={tpl.templateId}
            template={tpl}
            entries={tplEntries}
            hqId={hqId}
            onEntryCreated={onEntryCreated}
            onEntryUpdated={onEntryUpdated}
            onEntryDeleted={onEntryDeleted}
          />
        );
      })}
    </div>
  );
}

function findParamId(template, ...titles) {
  const params = template.parameters || [];
  for (const title of titles) {
    const found = params.find(p => p.title.trim() === title.trim());
    if (found) return found.parameterId;
  }
  return null;
}

function getParamValue(entry, parameterId) {
  if (!parameterId) return null;
  const v = (entry.values || []).find(x => x.parameterId === parameterId);
  if (v?.value === null || v?.value === undefined || v?.value === "") return null;
  return Number(v.value);
}

function buildComputedColumns(template) {
  const baieReceId = findParamId(template, "Baie - Apa Rece");
  const bucReceId  = findParamId(template, "Bucatarie - Apa Rece", "Bucatarie  - Apa Rece");
  const baieCalId  = findParamId(template, "Baie - Apa Calda");
  const bucCalId   = findParamId(template, "Bucatarie - Apa Calda", "Bucatarie  - Apa Calda");

  const cols = [];
  if (baieReceId && bucReceId) cols.push({ title: "Consum Apa Rece",  receIds: [baieReceId, bucReceId] });
  if (baieCalId  && bucCalId)  cols.push({ title: "Consum Apa Calda", receIds: [baieCalId,  bucCalId]  });
  return cols;
}

function computeMonthlyConsumption(entries, cols) {
  if (cols.length === 0) return {};

  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const result = {};

  for (let i = 0; i < sorted.length; i++) {
    const curr = sorted[i];
    result[curr.entryId] = {};

    if (i === 0) continue;

    const prev = sorted[i - 1];
    const days = (new Date(curr.date) - new Date(prev.date)) / 86400000;
    if (days <= 0) continue;

    for (const col of cols) {
      const currSum = col.receIds.reduce((s, id) => {
        const v = getParamValue(curr, id);
        return v !== null ? s + v : s;
      }, 0);
      const prevSum = col.receIds.reduce((s, id) => {
        const v = getParamValue(prev, id);
        return v !== null ? s + v : s;
      }, 0);
      const monthlyAvg = (currSum - prevSum) / days * 30;
      result[curr.entryId][col.title] = Math.round(monthlyAvg * 100) / 100;
    }
  }

  return result;
}

function buildSmsText(template, entries) {
  const baieReceId = findParamId(template, "Baie - Apa Rece");
  const baieCalId  = findParamId(template, "Baie - Apa Calda");
  const bucReceId  = findParamId(template, "Bucatarie - Apa Rece", "Bucatarie  - Apa Rece");
  const bucCalId   = findParamId(template, "Bucatarie - Apa Calda", "Bucatarie  - Apa Calda");

  if (!baieReceId || !baieCalId || !bucReceId || !bucCalId) return null;

  const latest = entries[0]; // already sorted descending
  if (!latest) return null;

  const val = id => getParamValue(latest, id) ?? "—";

  return `Nenciulescu - Sc. 6, Ap. 68\nIndexi:\n- Baie Rece: ${val(baieReceId)}\n- Baie Calda: ${val(baieCalId)}\n- Bucatarie Rece: ${val(bucReceId)}\n- Bucatarie Calda: ${val(bucCalId)}`;
}

function TemplateSection({ template, entries, hqId, onEntryCreated, onEntryUpdated, onEntryDeleted }) {
  const [newRowOpen, setNewRowOpen] = useState(false);
  const [smsOpen, setSmsOpen]       = useState(false);
  const [copied, setCopied]         = useState(false);
  const computedColumns = buildComputedColumns(template);
  const computedValues  = computeMonthlyConsumption(entries, computedColumns);
  const smsText         = buildSmsText(template, entries);

  function handleCopy() {
    navigator.clipboard.writeText(smsText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={s.section}>
      <div style={s.sectionHeader}>
        <span style={s.sectionTitle}>{template.name}</span>
        <div style={{ display: "flex", gap: "6px" }}>
          {smsText && (
            <button style={s.btnSm} onClick={() => setSmsOpen(true)}>
              Generate SMS text
            </button>
          )}
          <button
            style={s.btnSm}
            onClick={() => setNewRowOpen(true)}
            disabled={newRowOpen}
          >
            + New Entry
          </button>
        </div>
      </div>

      <EntryTable
        template={template}
        entries={entries}
        hqId={hqId}
        externalNewRow={newRowOpen}
        onNewRowDone={() => setNewRowOpen(false)}
        onEntryCreated={onEntryCreated}
        onEntryUpdated={onEntryUpdated}
        onEntryDeleted={onEntryDeleted}
        computedColumns={computedColumns}
        computedValues={computedValues}
      />

      {smsOpen && (
        <div
          onClick={() => { setSmsOpen(false); setCopied(false); }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px", width: "100%", maxWidth: "360px", boxShadow: "0 20px 50px rgba(0,0,0,0.4)", display: "flex", flexDirection: "column" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>SMS Text</span>
              <button onClick={() => { setSmsOpen(false); setCopied(false); }} style={{ background: "transparent", border: "none", color: "var(--text-muted)", fontSize: "16px", cursor: "pointer", lineHeight: 1, padding: "2px 4px" }}>✕</button>
            </div>
            <pre style={{ margin: 0, padding: "16px", fontFamily: "inherit", fontSize: "13px", color: "var(--text)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
              {smsText}
            </pre>
            <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                onClick={handleCopy}
                style={{ background: copied ? "rgba(34,197,94,0.15)" : "var(--accent)", color: copied ? "#16a34a" : "#000", border: copied ? "1px solid rgba(34,197,94,0.4)" : "none", borderRadius: "8px", padding: "6px 16px", fontSize: "12px", fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
              >
                {copied ? "Copied ✓" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
