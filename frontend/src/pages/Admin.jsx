import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useAppSettings } from "../context/AppSettingsContext";
import { listUsers, updateUserRole, deleteUser } from "../api/admin";
import { backupPreview, backupPrepare, backupRunTable } from "../api/adminBackup";
import { getFxRates, updateFxRates } from "../api/fxRates";

const FX_CURRENCIES = ["EUR", "USD", "RON"];

export default function Admin() {
  const { user, verifyPassword } = useAuth();

  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  // Delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState(null); // user object
  const [password, setPassword]         = useState("");
  const [deleting, setDeleting]         = useState(false);
  const [deleteError, setDeleteError]   = useState(null);

  // Role update busy state
  const [roleLoading, setRoleLoading] = useState(null); // username

  // App settings
  const { settings, saveSettings } = useAppSettings();
  const [savingKey, setSavingKey] = useState(null);

  // Backup
  // phase: null | "loading" | "preview" | "running" | "done"
  // rows: [{ name, count, status: "pending"|"running"|"ok"|"error", rows?, error? }]
  const [backupModal, setBackupModal] = useState(null);
  const [backupError, setBackupError] = useState(null);

  // FX rates (shared across all users, stored in DB)
  const [fx, setFx]             = useState(null); // { rates, updatedAt }
  const [fxUpdating, setFxUpdating] = useState(false);
  const [fxError, setFxError]   = useState(null);

  useEffect(() => {
    getFxRates().then(setFx).catch(() => {});
  }, []);

  async function handleUpdateFx() {
    if (fxUpdating) return;
    setFxUpdating(true);
    setFxError(null);
    try {
      const { rates, updatedAt } = await updateFxRates();
      setFx({ rates, updatedAt });
    } catch (e) {
      setFxError(e?.response?.data?.message || e.message || "Update failed");
    } finally {
      setFxUpdating(false);
    }
  }

  async function handleBackupClick() {
    setBackupError(null);
    setBackupModal({ phase: "loading" });
    try {
      const data = await backupPreview();
      setBackupModal({
        phase: "preview",
        folderName: data.folderName,
        folderUrl:  null,
        rows: data.tables.map(t => ({ name: t.name, count: t.count, error: t.error, status: t.error ? "error" : "pending" })),
      });
    } catch (e) {
      setBackupError(e?.response?.data?.message || e.message || "Preview failed");
      setBackupModal(null);
    }
  }

  async function handleBackupConfirm() {
    // Mark all rows pending, switch to running
    setBackupModal(m => ({ ...m, phase: "running" }));

    let folderId, folderName, folderUrl;
    try {
      const prep = await backupPrepare();
      folderId  = prep.folderId;
      folderName = prep.folderName;
      folderUrl  = prep.folderUrl;
      setBackupModal(m => ({ ...m, folderName, folderUrl }));
    } catch (e) {
      setBackupModal(m => ({ ...m, phase: "done", folderError: e?.response?.data?.message || e.message || "Folder creation failed" }));
      return;
    }

    const tableNames = backupModal.rows.map(r => r.name);
    for (const tableName of tableNames) {
      setBackupModal(m => ({
        ...m,
        rows: m.rows.map(r => r.name === tableName ? { ...r, status: "running" } : r),
      }));
      const result = await backupRunTable(tableName, folderId).catch(e => ({
        table: tableName, rows: 0, ok: false,
        error: e?.response?.data?.message || e.message,
      }));
      setBackupModal(m => ({
        ...m,
        rows: m.rows.map(r => r.name === tableName
          ? { ...r, status: result.ok ? "ok" : "error", rows: result.rows, error: result.error }
          : r),
      }));
    }

    setBackupModal(m => ({ ...m, phase: "done" }));
  }

  const handleToggle = async (key) => {
    setSavingKey(key);
    try {
      await saveSettings({ [key]: !settings[key] });
    } catch {
      setError("Failed to save setting.");
    } finally {
      setSavingKey(null);
    }
  };

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .catch((e) => {
        if (e.response?.status === 401 || e.response?.status === 403) {
          setError("Session does not include admin permissions yet. Please sign out and sign back in, then try again.");
        } else {
          setError(`Failed to load users (HTTP ${e.response?.status ?? "none"}: ${e.response?.data?.message || e.message || "unknown"})`);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleRoleToggle = async (u) => {
    const newRole = u.role === "admin" ? "normal" : "admin";
    setRoleLoading(u.username);
    try {
      await updateUserRole(u.username, newRole);
      setUsers(prev => prev.map(x => x.username === u.username ? { ...x, role: newRole } : x));
    } catch {
      setError("Failed to update role.");
    } finally {
      setRoleLoading(null);
    }
  };

  const openDeleteModal = (u) => {
    setDeleteTarget(u);
    setPassword("");
    setDeleteError(null);
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setPassword("");
    setDeleteError(null);
  };

  const confirmDelete = async () => {
    if (!password) { setDeleteError("Please enter your password."); return; }
    setDeleting(true);
    setDeleteError(null);
    try {
      await verifyPassword(password);
    } catch {
      setDeleteError("Wrong password. Please try again.");
      setDeleting(false);
      return;
    }
    try {
      await deleteUser(deleteTarget.username);
      setUsers(prev => prev.filter(u => u.username !== deleteTarget.username));
      closeDeleteModal();
    } catch (e) {
      setDeleteError(e.response?.data?.message || "Failed to delete user.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) return <div style={s.page}><p style={s.muted}>Loading…</p></div>;

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>Admin Panel</h1>
        <p style={s.subtitle}>{users.length} account{users.length !== 1 ? "s" : ""} registered</p>
      </div>

      {error && <div style={s.errorBox}>{error}</div>}

      <div style={s.columns}>
        {/* Left: Settings */}
        <div style={s.leftCol}>
          <div style={s.settingsCard}>
            <div style={s.settingsTitle}>App Settings</div>
            {[
              { key: "backstageEnabled",     label: "Backstage menu",   desc: "Show or hide the Backstage link in the sidebar for all users" },
              { key: "googleLoginEnabled",   label: "Google Sign-In",   desc: "Allow users to log in with their Google account" },
              { key: "createAccountEnabled", label: "Create account",   desc: "Allow new users to register from the login page" },
            ].map(({ key, label, desc }, i) => {
              const on = settings[key];
              return (
                <div key={key} style={{ ...s.settingRow, ...(i > 0 ? { marginTop: "14px" } : {}) }}>
                  <div>
                    <div style={s.settingLabel}>{label}</div>
                    <div style={s.settingDesc}>{desc}</div>
                  </div>
                  <button
                    style={{ ...s.toggle, ...(on ? s.toggleOn : s.toggleOff), opacity: savingKey === key ? 0.6 : 1 }}
                    onClick={() => handleToggle(key)}
                    disabled={savingKey === key}
                  >
                    <span style={{ ...s.toggleThumb, transform: on ? "translateX(18px)" : "translateX(2px)" }} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* FX Rates */}
          <div style={{ ...s.settingsCard, marginTop: "16px" }}>
            <div style={s.settingsTitle}>FX Rates</div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 14px", lineHeight: 1.5 }}>
              Conversion rates between EUR, USD and RON used across the app for all
              users. Update fetches the latest rates and stores every combination in
              the database.
            </p>
            <div style={{ marginBottom: "6px" }}>
              {fx?.rates?.EUR ? (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr>
                      <th style={s.fxCornerCell}>1 →</th>
                      {FX_CURRENCIES.map(to => (
                        <th key={to} style={s.fxHeadCell}>{to}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {FX_CURRENCIES.map(from => (
                      <tr key={from}>
                        <td style={s.fxHeadCell}>{from}</td>
                        {FX_CURRENCIES.map(to => (
                          <td key={to} style={{ ...s.fxCell, ...(from === to ? { color: "var(--text-muted)" } : {}) }}>
                            {fx.rates[from]?.[to] ?? "—"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>No rates stored yet.</div>
              )}
            </div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginBottom: "12px" }}>
              {fx?.updatedAt ? `Last updated: ${new Date(fx.updatedAt).toLocaleString()}` : " "}
            </div>
            {fxError && (
              <div style={{ ...s.deleteError, marginBottom: "10px" }}>{fxError}</div>
            )}
            <button
              style={{ ...s.btn, background: "var(--accent)", color: "#000", border: "none", width: "100%", padding: "9px", fontSize: "12px", opacity: fxUpdating ? 0.6 : 1, cursor: fxUpdating ? "not-allowed" : "pointer" }}
              onClick={handleUpdateFx}
              disabled={fxUpdating}
            >
              {fxUpdating ? "Updating…" : "Update FX rates"}
            </button>
          </div>

          {/* Database Backup */}
          <div style={{ ...s.settingsCard, marginTop: "16px" }}>
            <div style={s.settingsTitle}>Database Backup</div>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 14px", lineHeight: 1.5 }}>
              Export all DynamoDB tables to CSV and save them to Google Drive.
            </p>
            {backupError && (
              <div style={{ ...s.deleteError, marginBottom: "10px" }}>{backupError}</div>
            )}
            <button
              style={{ ...s.btn, background: "var(--accent)", color: "#000", border: "none", width: "100%", padding: "9px", fontSize: "12px" }}
              onClick={handleBackupClick}
              disabled={backupModal !== null}
            >
              {backupModal?.phase === "loading" ? "Loading…" : "Backup ALL Tables"}
            </button>
          </div>
        </div>

        {/* Right: Users */}
        <div style={s.rightCol}>
          <div style={s.usersCard}>
            <div style={s.settingsTitle}>Users</div>
      <div style={s.tableWrap}>
        <table style={s.table}>
          <thead>
            <tr>
              {["User", "Email", "Type", "Status", "Incomes", "Expenses", "Total entries", "Actions"].map(h => (
                <th key={h} style={s.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(u => {
              const isSelf  = u.username === user?.username;
              const isAdmin = u.role === "admin";
              const total   = u.incomes + u.expenses;
              return (
                <tr key={u.username} style={{ ...s.tr, ...(isSelf ? s.trSelf : {}) }}>
                  <td style={{ ...s.td, textAlign: "left" }}>
                    <div style={s.usernameCell}>
                      <div style={{ ...s.avatar, background: isAdmin ? "rgba(168,85,247,0.15)" : "var(--avatar-bg)", border: `1px solid ${isAdmin ? "#a855f7" : "var(--avatar-border)"}`, color: isAdmin ? "#a855f7" : "var(--avatar-color)" }}>
                        {u.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={s.usernameText}>{u.username}</div>
                        {isSelf && <div style={s.selfBadge}>You</div>}
                      </div>
                    </div>
                  </td>
                  <td style={{ ...s.td, ...s.emailCell }}>{u.email ?? <span style={s.noEmail}>—</span>}</td>
                  <td style={s.td}>
                    <span style={{ ...s.roleBadge, ...(isAdmin ? s.roleBadgeAdmin : s.roleBadgeNormal) }}>
                      {isAdmin ? "Admin" : "Normal"}
                    </span>
                  </td>
                  <td style={s.td}>
                    <span style={{ ...s.statusDot, background: u.enabled ? "var(--accent)" : "var(--text-muted)" }} />
                    {u.enabled ? "Active" : "Disabled"}
                  </td>
                  <td style={{ ...s.td, ...s.numCell }}>{u.incomes}</td>
                  <td style={{ ...s.td, ...s.numCell }}>{u.expenses}</td>
                  <td style={{ ...s.td, ...s.numCell }}>{total}</td>
                  <td style={s.td}>
                    <div style={s.actions}>
                      <button
                        style={{ ...s.btn, ...s.btnRole }}
                        onClick={() => handleRoleToggle(u)}
                        disabled={roleLoading === u.username || isSelf}
                        title={isSelf ? "Cannot change your own role" : `Set as ${isAdmin ? "Normal" : "Admin"}`}
                      >
                        {roleLoading === u.username ? "…" : isAdmin ? "→ Normal" : "→ Admin"}
                      </button>
                      {!isSelf && (
                        <button
                          style={{ ...s.btn, ...s.btnDelete }}
                          onClick={() => openDeleteModal(u)}
                          title="Delete user and all data"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
          </div>{/* end usersCard */}
        </div>{/* end rightCol */}
      </div>{/* end columns */}

      {/* Backup modal — unified */}
      {backupModal && backupModal.phase !== "loading" && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, maxWidth: "500px" }}>
            {/* Title */}
            <h2 style={s.modalTitle}>
              {backupModal.phase === "preview" && "Backup ALL Tables"}
              {backupModal.phase === "running" && "Backup in progress…"}
              {backupModal.phase === "done" && (backupModal.folderError ? "Backup failed" : backupModal.rows.every(r => r.status === "ok") ? "Backup complete" : "Backup completed with errors")}
            </h2>

            {/* Folder error */}
            {backupModal.phase === "done" && backupModal.folderError && (
              <p style={{ ...s.modalBody, color: "var(--danger)" }}>{backupModal.folderError}</p>
            )}

            {/* Destination + Drive link */}
            {backupModal.phase === "preview" && (
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 4px" }}>
                Destination: <strong style={{ color: "var(--text)" }}>4TURA_DB_Backups / {backupModal.folderName}</strong>
              </p>
            )}
            {(backupModal.phase === "running" || backupModal.phase === "done") && backupModal.folderName && (
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 4px" }}>
                Folder: <strong style={{ color: "var(--text)" }}>4TURA_DB_Backups / {backupModal.folderName}</strong>
                {backupModal.folderUrl && (
                  <> · <a href={backupModal.folderUrl} target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>Open ↗</a></>
                )}
              </p>
            )}

            {backupModal.phase === "preview" && (
              <p style={{ fontSize: "11px", color: "var(--danger)", margin: "4px 0 14px" }}>
                Warning: This will export data for ALL users.
              </p>
            )}

            {/* Table */}
            {!backupModal.folderError && (
              <div style={{ border: "1px solid var(--border)", borderRadius: "8px", overflow: "hidden", margin: "12px 0 20px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-2)" }}>
                      <th style={{ padding: "7px 12px", textAlign: "left",   color: "var(--text-muted)", fontWeight: 600 }}>Table</th>
                      <th style={{ padding: "7px 12px", textAlign: "right",  color: "var(--text-muted)", fontWeight: 600 }}>
                        {backupModal.phase === "preview" ? "Items" : "Rows"}
                      </th>
                      <th style={{ padding: "7px 12px", textAlign: "center", color: "var(--text-muted)", fontWeight: 600 }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backupModal.rows.map((r, i) => {
                      const statusColor =
                        r.status === "ok"      ? "#16a34a" :
                        r.status === "error"   ? "var(--danger)" :
                        r.status === "running" ? "var(--accent)" :
                        "var(--text-muted)";
                      const statusLabel =
                        r.status === "ok"      ? "✓" :
                        r.status === "error"   ? "✗" :
                        r.status === "running" ? "…" :
                        "—";
                      return (
                        <tr key={r.name} style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}>
                          <td style={{ padding: "6px 12px", color: "var(--text)" }}>
                            {r.name}
                            {r.error && <div style={{ fontSize: "10px", color: "var(--danger)", marginTop: "2px" }}>{r.error}</div>}
                          </td>
                          <td style={{ padding: "6px 12px", color: "var(--text)", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                            {r.count === -1 ? "—" : r.status === "pending" || r.status === "running" ? r.count : r.rows ?? r.count}
                          </td>
                          <td style={{ padding: "6px 12px", textAlign: "center", color: statusColor, fontWeight: 700 }}>
                            {statusLabel}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Actions */}
            <div style={s.modalActions}>
              {backupModal.phase === "preview" && (
                <>
                  <button style={s.btnCancel} onClick={() => setBackupModal(null)}>Cancel</button>
                  <button
                    style={{ background: "var(--accent)", color: "#000", border: "none", borderRadius: "8px", padding: "8px 20px", fontWeight: 600, fontSize: "13px", cursor: "pointer" }}
                    onClick={handleBackupConfirm}
                  >
                    Confirm & Backup
                  </button>
                </>
              )}
              {backupModal.phase === "done" && (
                <button style={s.btnCancel} onClick={() => setBackupModal(null)}>Close</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h2 style={s.modalTitle}>Delete user?</h2>
            <p style={s.modalBody}>
              This will permanently delete{" "}
              <strong style={{ color: "var(--text)" }}>{deleteTarget.username}</strong> and all their data
              ({deleteTarget.incomes} income{deleteTarget.incomes !== 1 ? "s" : ""},{" "}
              {deleteTarget.expenses} expense{deleteTarget.expenses !== 1 ? "s" : ""}). This cannot be undone.
            </p>

            <div style={s.passwordBlock}>
              <label style={s.passwordLabel}>Enter your password to confirm</label>
              <input
                style={s.passwordInput}
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === "Enter" && confirmDelete()}
                placeholder="Your password"
                autoFocus
              />
            </div>

            {deleteError && <div style={s.deleteError}>{deleteError}</div>}

            <div style={s.modalActions}>
              <button style={s.btnCancel} onClick={closeDeleteModal} disabled={deleting}>
                Cancel
              </button>
              <button style={{ ...s.btnConfirmDelete, opacity: deleting ? 0.6 : 1 }} onClick={confirmDelete} disabled={deleting}>
                {deleting ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page: {
    display:       "flex",
    flexDirection: "column",
    flex:          1,
    minHeight:     0,
    gap:           "16px",
    overflowY:     "auto",
  },
  header: { flexShrink: 0 },
  columns: {
    display:    "flex",
    gap:        "20px",
    alignItems: "flex-start",
    flex:       1,
    minHeight:  0,
  },
  leftCol: {
    width:     "280px",
    flexShrink: 0,
  },
  rightCol: {
    flex:      1,
    minWidth:  0,
    overflowX: "auto",
  },
  title:  { fontSize: "18px", fontWeight: 700, color: "var(--text)", margin: 0 },
  subtitle: { fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" },
  muted:  { color: "var(--text-muted)", fontSize: "13px" },
  errorBox: {
    background:   "var(--error-bg)", border: "1px solid var(--danger)",
    borderRadius: "8px", color: "var(--error-text)", padding: "10px 14px", fontSize: "12px",
  },
  settingsCard: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px",
    padding: "16px 20px", flexShrink: 0,
  },
  usersCard: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "12px",
    padding: "16px 20px", overflow: "hidden",
  },
  settingsTitle: { fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "14px" },
  fxCornerCell: { padding: "4px 6px", textAlign: "left", fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", borderBottom: "1px solid var(--border)" },
  fxHeadCell:   { padding: "4px 6px", textAlign: "center", fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", borderBottom: "1px solid var(--border)" },
  fxCell:       { padding: "4px 6px", textAlign: "center", fontVariantNumeric: "tabular-nums", color: "var(--text)", borderBottom: "1px solid var(--border)" },
  settingRow:  { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" },
  settingLabel:{ fontSize: "13px", fontWeight: 600, color: "var(--text)" },
  settingDesc: { fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" },
  toggle: { width: "40px", height: "22px", borderRadius: "11px", border: "none", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background 0.2s" },
  toggleOn:  { background: "var(--accent)" },
  toggleOff: { background: "var(--border)" },
  toggleThumb: { position: "absolute", top: "3px", width: "16px", height: "16px", borderRadius: "50%", background: "#fff", transition: "transform 0.2s", display: "block" },
  tableWrap: { flexShrink: 0 },
  table:    { width: "100%", borderCollapse: "collapse", minWidth: "700px" },
  th:       { textAlign: "center", fontSize: "11px", color: "var(--text-muted)", padding: "8px 12px", borderBottom: "2px solid var(--border)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" },
  tr:       { borderBottom: "1px solid var(--border)", transition: "background 0.1s" },
  trSelf:   { background: "rgba(22,163,74,0.04)" },
  td:       { padding: "10px 12px", fontSize: "13px", color: "var(--text)", verticalAlign: "middle", textAlign: "center" },
  numCell:  { fontVariantNumeric: "tabular-nums" },
  emailCell:{ fontSize: "12px", color: "var(--text-muted)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  noEmail:  { color: "var(--border)", fontSize: "12px" },
  usernameCell: { display: "flex", alignItems: "center", gap: "10px" },
  avatar: {
    width: "30px", height: "30px", borderRadius: "50%",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: "10px", fontWeight: 700, flexShrink: 0,
  },
  usernameText: { fontSize: "13px", fontWeight: 500, color: "var(--text)" },
  selfBadge: {
    fontSize: "10px", color: "var(--accent)", fontWeight: 600,
    background: "rgba(22,163,74,0.1)", padding: "1px 5px", borderRadius: "4px",
    display: "inline-block", marginTop: "2px",
  },
  roleBadge:       { padding: "3px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: 600 },
  roleBadgeAdmin:  { background: "rgba(168,85,247,0.12)", color: "#a855f7", border: "1px solid rgba(168,85,247,0.4)" },
  roleBadgeNormal: { background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" },
  statusDot: { display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", marginRight: "6px", verticalAlign: "middle" },
  actions: { display: "flex", gap: "6px" },
  btn: { borderRadius: "7px", fontSize: "11px", fontWeight: 600, padding: "5px 11px", cursor: "pointer", border: "none", whiteSpace: "nowrap" },
  btnRole:   { background: "var(--surface-2)", color: "var(--text-muted)", border: "1px solid var(--border)" },
  btnDelete: { background: "rgba(239,68,68,0.1)", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.3)" },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
    backdropFilter: "blur(2px)", display: "flex", alignItems: "center",
    justifyContent: "center", zIndex: 200,
  },
  modal: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "14px",
    padding: "28px 32px", width: "100%", maxWidth: "400px", boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
  },
  modalTitle:  { fontSize: "16px", fontWeight: 700, color: "var(--text)", margin: "0 0 10px" },
  modalBody:   { fontSize: "13px", color: "var(--text-muted)", lineHeight: 1.6, margin: "0 0 20px" },
  passwordBlock: { display: "flex", flexDirection: "column", gap: "6px", marginBottom: "12px" },
  passwordLabel: { fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" },
  passwordInput: {
    background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: "8px",
    color: "var(--text)", fontSize: "16px", padding: "9px 12px", outline: "none", width: "100%", boxSizing: "border-box",
  },
  deleteError: {
    background: "var(--error-bg)", border: "1px solid var(--danger)", borderRadius: "8px",
    color: "var(--error-text)", fontSize: "12px", padding: "8px 12px", marginBottom: "12px",
  },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: "10px" },
  btnCancel: {
    background: "transparent", color: "var(--text-muted)", border: "1px solid var(--border)",
    borderRadius: "8px", padding: "8px 20px", fontWeight: 500, fontSize: "13px", cursor: "pointer",
  },
  btnConfirmDelete: {
    background: "var(--danger)", color: "#fff", border: "none",
    borderRadius: "8px", padding: "8px 20px", fontWeight: 600, fontSize: "13px", cursor: "pointer",
  },
};
