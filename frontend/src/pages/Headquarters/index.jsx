import { useState, useEffect } from "react";
import {
  listLocations,
  listTemplates,
  listEntries,
} from "../../api/headquarters";
import DashboardTab from "./DashboardTab";
import LocationTab  from "./LocationTab";
import SettingsTab  from "./SettingsTab";
import s from "./styles";

export default function Headquarters() {
  const [locations,  setLocations]  = useState([]);
  const [templates,  setTemplates]  = useState([]);
  const [entries,    setEntries]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [activeTab,  setActiveTab]  = useState("__dashboard__");

  useEffect(() => {
    setLoading(true);
    Promise.all([listLocations(), listTemplates(), listEntries()])
      .then(([locs, tpls, ents]) => {
        setLocations(locs);
        setTemplates(tpls);
        setEntries(ents);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // ── Mutation handlers ──────────────────────────────────────────────────────

  function handleLocationSaved(result, isEdit) {
    if (isEdit) {
      setLocations(ls => ls.map(l => l.hqId === result.hqId ? result : l));
    } else {
      setLocations(ls => [...ls, result].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
      setActiveTab(result.hqId);
    }
  }

  function handleLocationDeleted(hqId) {
    setLocations(ls => ls.filter(l => l.hqId !== hqId));
    if (activeTab === hqId) setActiveTab("__dashboard__");
  }

  function handleTemplateSaved(result, isEdit) {
    if (isEdit) {
      setTemplates(ts => ts.map(t => t.templateId === result.templateId ? result : t));
    } else {
      setTemplates(ts => [...ts, result]);
    }
  }

  function handleTemplateDeleted(templateId) {
    setTemplates(ts => ts.filter(t => t.templateId !== templateId));
    setEntries(es => es.filter(e => e.templateId !== templateId));
  }

  function handleEntryCreated(entry) {
    setEntries(es => [entry, ...es]);
  }

  function handleEntryUpdated(entry) {
    setEntries(es => es.map(e => e.entryId === entry.entryId ? entry : e));
  }

  function handleEntryDeleted(entryId) {
    setEntries(es => es.filter(e => e.entryId !== entryId));
  }

  // ── Build tabs ─────────────────────────────────────────────────────────────

  const tabs = [
    { id: "__dashboard__", label: "HQ Dashboard" },
    ...locations.map(loc => ({ id: loc.hqId, label: loc.name, isLocation: true, loc })),
    { id: "__settings__",  label: "Settings" },
  ];

  if (loading) return <div style={s.center}>Loading…</div>;
  if (error)   return <div style={{ ...s.center, color: "var(--danger)" }}>{error}</div>;

  return (
    <div style={s.root}>
      {/* Tab bar */}
      <div style={s.tabBar}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            style={{ ...s.tabBtn, ...(activeTab === tab.id ? s.tabBtnActive : {}) }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={s.content}>
        {activeTab === "__dashboard__" && (
          <DashboardTab
            locations={locations}
            templates={templates}
            entries={entries}
          />
        )}

        {locations.map(loc => (
          activeTab === loc.hqId && (
            <LocationTab
              key={loc.hqId}
              hqId={loc.hqId}
              templates={templates}
              entries={entries}
              onEntryCreated={handleEntryCreated}
              onEntryUpdated={handleEntryUpdated}
              onEntryDeleted={handleEntryDeleted}
            />
          )
        ))}

        {activeTab === "__settings__" && (
          <SettingsTab
            locations={locations}
            templates={templates}
            onLocationSaved={handleLocationSaved}
            onLocationDeleted={handleLocationDeleted}
            onTemplateSaved={handleTemplateSaved}
            onTemplateDeleted={handleTemplateDeleted}
          />
        )}
      </div>
    </div>
  );
}
