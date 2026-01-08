import { useState } from "react";

export default function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
  className = "",
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`cs-card ${className}`}>
      {/* Header */}
      <div className="cs-header" onClick={() => setOpen((v) => !v)}>
        <h2 className="cs-title">{title}</h2>
        <button
          type="button"
          className="cs-toggle"
          aria-expanded={open}
          onClick={(e) => {
            e.stopPropagation();
            setOpen((v) => !v);
          }}
        >
          {open ? "收合" : "展開"}
          <span className={`cs-chevron ${open ? "rot" : ""}`}>▾</span>
        </button>
      </div>

      {/* Body */}
      <div className={`cs-body ${open ? "open" : "closed"}`}>
        {children}
      </div>
    </section>
  );
}
