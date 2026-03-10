import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { listUsers, updateUserRole, deleteUser } from "../api/admin";

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
                  <td style={s.td}>
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
                      <button
                        style={{ ...s.btn, ...s.btnDelete }}
                        onClick={() => openDeleteModal(u)}
                        disabled={isSelf}
                        title={isSelf ? "Cannot delete your own account" : "Delete user and all data"}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
  title:  { fontSize: "18px", fontWeight: 700, color: "var(--text)", margin: 0 },
  subtitle: { fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" },
  muted:  { color: "var(--text-muted)", fontSize: "13px" },
  errorBox: {
    background:   "var(--error-bg)", border: "1px solid var(--danger)",
    borderRadius: "8px", color: "var(--error-text)", padding: "10px 14px", fontSize: "12px",
  },
  tableWrap: { overflowX: "auto", flexShrink: 0 },
  table:    { width: "100%", borderCollapse: "collapse", minWidth: "700px" },
  th:       { textAlign: "left", fontSize: "11px", color: "var(--text-muted)", padding: "8px 12px", borderBottom: "2px solid var(--border)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", whiteSpace: "nowrap" },
  tr:       { borderBottom: "1px solid var(--border)", transition: "background 0.1s" },
  trSelf:   { background: "rgba(22,163,74,0.04)" },
  td:       { padding: "10px 12px", fontSize: "13px", color: "var(--text)", verticalAlign: "middle" },
  numCell:  { fontVariantNumeric: "tabular-nums", textAlign: "right" },
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
