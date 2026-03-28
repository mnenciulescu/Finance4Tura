import s from "./styles";

export default function Modal({ title, onClose, children, wide }) {
  return (
    <div style={s.overlay} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...s.modal, ...(wide ? { maxWidth: "680px" } : {}) }}>
        <div style={s.modalHeader}>
          <span style={s.modalTitle}>{title}</span>
          <button style={s.modalClose} onClick={onClose}>✕</button>
        </div>
        <div style={s.modalBody}>{children}</div>
      </div>
    </div>
  );
}
