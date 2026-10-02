import { useEffect, useRef } from "react";
import { X } from "lucide-react";

// Native <dialog> wrapper: focus trapping, Escape, and backdrop clicks.
export default function Dialog({ open, onClose, title, children, className = "", labelledBy, wide = false }) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal?.();
    else if (!open && el.open) el.close?.();
  }, [open]);

  const onClick = (e) => {
    // A click on the backdrop lands on the dialog element itself.
    if (e.target === ref.current) onClose?.();
  };

  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "dialog-wide" : ""} ${className}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
      onClick={onClick}
      aria-labelledby={labelledBy}
    >
      <div className="dialog-body">
        <button type="button" className="icon-btn dialog-close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        {title && <h2 id={labelledBy}>{title}</h2>}
        {open && children}
      </div>
    </dialog>
  );
}
