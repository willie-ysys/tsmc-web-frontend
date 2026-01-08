// src/components/InfoHint.jsx
import React, { useEffect, useRef, useState } from "react";

/**
 * 輕量點擊說明泡泡：
 *   <InfoHint label="RMSE (1M)">說明文字</InfoHint>
 * - 只需點「i」會開啟/關閉；按 ESC 或點外面會關閉
 * - 風格：小、灰、半透明（低存在感）
 */
export default function InfoHint({
  label,
  children,
  className = "",
  placement = "top", // top | bottom | left | right
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const popPos = {
    top:    { bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: 8 },
    bottom: { top: "100%",   left: "50%", transform: "translateX(-50%)", marginTop: 8 },
    left:   { right: "100%", top: "50%",  transform: "translateY(-50%)", marginRight: 8 },
    right:  { left: "100%",  top: "50%",  transform: "translateY(-50%)", marginLeft: 8 },
  }[placement];

  return (
    <span
      ref={ref}
      className={className}
      style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 6 }}
    >
      {/* 只負責顯示文字，不承擔點擊行為 */}
      <span style={{ display: "inline-flex", alignItems: "center" }}>{label}</span>

      {/* 低調小圓 i（只有它能切換開關） */}
      <button
        type="button"
        aria-label="說明"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        style={{
          width: 16,
          height: 16,
          borderRadius: "999px",
          border: "1px solid #94a3b8", // slate-400
          background: "transparent",
          color: "#64748b",             // slate-500
          fontSize: 11,
          lineHeight: "14px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          opacity: 0.45,                // 半透明：低存在感
          padding: 0,
          transition: "opacity .15s ease, transform .15s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.45")}
      >
        i
      </button>

      {open && (
        <div
          role="dialog"
          style={{
            position: "absolute",
            zIndex: 50,
            minWidth: 220,
            maxWidth: 360,
            padding: 10,
            borderRadius: 10,
            background: "#0b1220",
            color: "#e8f0ff",
            border: "1px solid rgba(148,163,184,.25)",
            boxShadow: "0 8px 24px rgba(0,0,0,.25)",
            fontSize: 12,
            lineHeight: 1.45,
            ...popPos,
          }}
        >
          {children}
        </div>
      )}
    </span>
  );
}
