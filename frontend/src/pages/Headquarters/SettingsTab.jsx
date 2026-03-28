import { useState } from "react";
import { deleteLocation, deleteTemplate } from "../../api/headquarters";
import LocationModal from "./LocationModal";
import TemplateModal from "./TemplateModal";
import s from "./styles";

export default function SettingsTab({ locations, templates, onLocationSaved, onLocationDeleted, onTemplateSaved, onTemplateDeleted }) {
  const [locationModal, setLocationModal]   = useState(null); // null | "new" | location object
  const [templateModal, setTemplateModal]   = useState(null); // null | "new" | template object
  const [deletingLocId, setDeletingLocId]   = useState(null);
  const [deletingTplId, setDeletingTplId]   = useState(null);
  const [locError, setLocError]             = useState(null);
  const [tplError, setTplError]             = useState(null);

  async function handleDeleteLocation(loc) {
    if (deletingLocId !== loc.hqId) { setDeletingLocId(loc.hqId); return; }
    setDeletingLocId(null);
    setLocError(null);
    try {
      await deleteLocation(loc.hqId);
      onLocationDeleted(loc.hqId);
    } catch (e) {
      setLocError(e?.response?.data?.message || e.message || "Delete failed");
    }
  }

  async function handleDeleteTemplate(tpl) {
    if (deletingTplId !== tpl.templateId) { setDeletingTplId(tpl.templateId); return; }
    setDeletingTplId(null);
    setTplError(null);
    try {
      await deleteTemplate(tpl.templateId);
      onTemplateDeleted(tpl.templateId);
    } catch (e) {
      setTplError(e?.response?.data?.message || e.message || "Delete failed");
    }
  }

  // Group templates by location
  const templatesByLocation = locations.map(loc => ({
    loc,
    templates: templates.filter(t => t.hqId === loc.hqId),
  }));
  const unassigned = templates.filter(t => !locations.find(l => l.hqId === t.hqId));

  return (
    <div style={s.tabContent}>

      {/* ── Locations ── */}
      <div style={s.settingsSection}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={s.settingsSectionTitle}>Locations</div>
          <button style={s.btnSm} onClick={() => setLocationModal("new")}>+ Add Location</button>
        </div>

        {locError && <div style={s.formError}>{locError}</div>}

        {locations.length === 0 ? (
          <div style={s.empty}>No locations yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {locations.map(loc => (
              <div key={loc.hqId} style={s.locationRow}>
                <div>
                  <div style={s.locationRowName}>{loc.name}</div>
                  {loc.address && <div style={s.locationRowAddr}>{loc.address}</div>}
                </div>
                <div style={{ display: "flex", gap: "4px" }}>
                  <button style={s.btnIcon} title="Edit" onClick={() => setLocationModal(loc)}>✎</button>
                  <button
                    style={{ ...s.btnIcon, color: deletingLocId === loc.hqId ? "var(--danger)" : "var(--text-muted)" }}
                    title={deletingLocId === loc.hqId ? "Click again to confirm" : "Delete"}
                    onClick={() => handleDeleteLocation(loc)}
                  >
                    {deletingLocId === loc.hqId ? "⚠ Del?" : "🗑"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Tracker Templates ── */}
      <div style={s.settingsSection}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={s.settingsSectionTitle}>Tracker Templates</div>
          <button
            style={s.btnSm}
            onClick={() => setTemplateModal("new")}
            disabled={locations.length === 0}
            title={locations.length === 0 ? "Add a location first" : undefined}
          >
            + Add Template
          </button>
        </div>

        {tplError && <div style={s.formError}>{tplError}</div>}

        {templates.length === 0 ? (
          <div style={s.empty}>No templates yet.</div>
        ) : (
          <>
            {templatesByLocation.map(({ loc, templates: locTpls }) => (
              locTpls.length > 0 && (
                <div key={loc.hqId}>
                  <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>{loc.name}</div>
                  <div style={s.cardGrid}>
                    {locTpls.map(tpl => (
                      <TemplateCard
                        key={tpl.templateId}
                        tpl={tpl}
                        onEdit={() => setTemplateModal(tpl)}
                        deletingTplId={deletingTplId}
                        onDelete={() => handleDeleteTemplate(tpl)}
                      />
                    ))}
                  </div>
                </div>
              )
            ))}
            {unassigned.length > 0 && (
              <div>
                <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", marginBottom: "6px" }}>Unknown Location</div>
                <div style={s.cardGrid}>
                  {unassigned.map(tpl => (
                    <TemplateCard
                      key={tpl.templateId}
                      tpl={tpl}
                      onEdit={() => setTemplateModal(tpl)}
                      deletingTplId={deletingTplId}
                      onDelete={() => handleDeleteTemplate(tpl)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {locationModal && (
        <LocationModal
          editing={locationModal === "new" ? null : locationModal}
          onClose={() => setLocationModal(null)}
          onSaved={(result, isEdit) => {
            onLocationSaved(result, isEdit);
            setLocationModal(null);
          }}
        />
      )}
      {templateModal && (
        <TemplateModal
          editing={templateModal === "new" ? null : templateModal}
          locations={locations}
          onClose={() => setTemplateModal(null)}
          onSaved={(result, isEdit) => {
            onTemplateSaved(result, isEdit);
            setTemplateModal(null);
          }}
        />
      )}
    </div>
  );
}

function TemplateCard({ tpl, onEdit, deletingTplId, onDelete }) {
  return (
    <div style={s.card}>
      <div style={s.cardTop}>
        <div>
          <div style={s.cardName}>{tpl.name}</div>
          <div style={s.cardSub}>{(tpl.parameters || []).length} parameter{(tpl.parameters || []).length !== 1 ? "s" : ""}</div>
        </div>
        <div style={s.cardActions}>
          <button style={s.btnIcon} title="Edit" onClick={onEdit}>✎</button>
          <button
            style={{ ...s.btnIcon, color: deletingTplId === tpl.templateId ? "var(--danger)" : "var(--text-muted)" }}
            title={deletingTplId === tpl.templateId ? "Click again to confirm" : "Delete"}
            onClick={onDelete}
          >
            {deletingTplId === tpl.templateId ? "⚠ Del?" : "🗑"}
          </button>
        </div>
      </div>
      <div style={s.metaRow}>
        {(tpl.parameters || []).slice(0, 5).map(p => (
          <span key={p.parameterId} style={s.metaBadge}>
            {p.title}{p.unit ? ` (${p.unit})` : ""}
          </span>
        ))}
        {(tpl.parameters || []).length > 5 && (
          <span style={s.metaBadge}>+{(tpl.parameters || []).length - 5} more</span>
        )}
      </div>
    </div>
  );
}
