import React, { PropsWithChildren, useEffect } from "react";

type Props = PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title?: string;
  width?: number;
}>;

export default function InfoHelp({ open, onClose, title = "說明", width = 420, children }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.38)",
        zIndex: 1000,
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: width,
          background: "#0b1220",
          color: "#e8f0ff",
          borderRadius: 12,
          boxShadow: "0 16px 48px rgba(0,0,0,.45)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: "1px solid #1f2a44" }}>
          <strong style={{ fontSize: 14 }}>{title}</strong>
          <button onClick={onClose} style={{ background: "transparent", border: 0, color: "#9fb4ff", cursor: "pointer", fontSize: 13 }}>關閉</button>
        </div>
        <div style={{ padding: 14, fontSize: 13, lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  );
}
