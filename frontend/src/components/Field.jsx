export default function Field({ label, children }) {
  return (
    <div style={s.field}>
      {label && <label style={s.label}>{label}</label>}
      {children}
    </div>
  );
}

const s = {
  field: { display: "flex", flexDirection: "column", gap: "5px" },
  label: { fontSize: "11px", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" },
};
