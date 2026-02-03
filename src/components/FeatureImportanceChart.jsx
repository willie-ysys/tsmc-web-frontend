// src/components/FeatureImportanceChart.jsx
import React, { useMemo, useState } from "react";

/**
 * FeatureImportanceChart
 * - 純 React / 不依賴第三方圖表套件
 * - Hover bar 顯示 tooltip（含 rank、feature、importance、以及其他原始欄位）
 *
 * props:
 * - data: Array<{ feature: string, importance: number, raw?: any }>
 * - title?: string
 * - height?: number (default 420)
 * - maxItems?: number (default 20)
 */
export default function FeatureImportanceChart({
  data,
  title = "Feature Importance",
  height = 420,
  maxItems = 20,
}) {
  const rows = useMemo(() => {
    const arr = Array.isArray(data) ? data.slice(0, maxItems) : [];
    const cleaned = arr
      .map((d, idx) => {
        const feature = String(d?.feature ?? d?.name ?? `feature_${idx}`);
        const importance = Number(d?.importance ?? d?.value ?? d?.gain ?? d?.score ?? 0);
        const raw = d?.raw ?? d;
        return { feature, importance, raw, _idx: idx };
      })
      .filter((d) => d.feature && Number.isFinite(d.importance));

    // importance 由大到小（如果你希望保留原順序，就把這行註解掉）
    cleaned.sort((a, b) => b.importance - a.importance);

    return cleaned;
  }, [data, maxItems]);

  const maxVal = useMemo(() => {
    let m = 0;
    for (const r of rows) m = Math.max(m, Math.abs(r.importance));
    return m || 1;
  }, [rows]);

  const [tip, setTip] = useState(null);
  // tip: { x, y, row, rank }

  const onEnter = (e, row, rank) => {
    const x = e?.clientX ?? 0;
    const y = e?.clientY ?? 0;
    setTip({ x, y, row, rank });
  };

  const onMove = (e) => {
    if (!tip) return;
    const x = e?.clientX ?? tip.x;
    const y = e?.clientY ?? tip.y;
    setTip((prev) => (prev ? { ...prev, x, y } : prev));
  };

  const onLeave = () => setTip(null);

  if (!rows.length) {
    return (
      <div style={{ opacity: 0.7 }}>
        目前沒有可用的特徵重要性資料。
      </div>
    );
  }

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 800, fontSize: 16 }}>{title}</div>
        <div style={{ opacity: 0.7, fontSize: 12 }}>Top {Math.min(rows.length, maxItems)}</div>
      </div>

      <div style={{ height, overflow: "auto", marginTop: 12, paddingRight: 6 }}>
        {rows.map((r, i) => {
          const rank = i + 1;
          const pct = Math.max(0, Math.min(100, (Math.abs(r.importance) / maxVal) * 100));
          return (
            <div
              key={`${r.feature}-${i}`}
              style={{
                display: "grid",
                gridTemplateColumns: "220px 1fr 90px",
                gap: 12,
                alignItems: "center",
                padding: "10px 6px",
                borderBottom: "1px solid rgba(0,0,0,0.08)",
              }}
            >
              <div style={{ fontSize: 13, lineHeight: 1.2 }}>
                <div style={{ fontWeight: 700 }}>
                  {rank}. {r.feature}
                </div>
                <div style={{ opacity: 0.7, fontSize: 12 }}>
                  importance
                </div>
              </div>

              <div
                onMouseEnter={(e) => onEnter(e, r, rank)}
                onMouseMove={onMove}
                onMouseLeave={onLeave}
                style={{
                  position: "relative",
                  height: 14,
                  borderRadius: 999,
                  background: "rgba(0,0,0,0.08)",
                  overflow: "hidden",
                  cursor: "default",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${pct}%`,
                    borderRadius: 999,
                    background: "rgba(0,0,0,0.55)",
                  }}
                />
              </div>

              <div style={{ textAlign: "right", fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 12 }}>
                {Number(r.importance).toFixed(6)}
              </div>
            </div>
          );
        })}
      </div>

      {tip && (
        <div
          style={{
            position: "fixed",
            left: tip.x + 14,
            top: tip.y + 14,
            zIndex: 9999,
            width: 360,
            maxWidth: "min(360px, calc(100vw - 24px))",
            background: "rgba(20,20,20,0.96)",
            color: "white",
            padding: 12,
            borderRadius: 12,
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontWeight: 900, fontSize: 13 }}>
            #{tip.rank} {tip.row.feature}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.95 }}>
            importance: <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}>
              {Number(tip.row.importance).toFixed(6)}
            </span>
          </div>

          <div style={{ marginTop: 8, fontSize: 11, opacity: 0.9 }}>
            raw fields:
          </div>
          <pre
            style={{
              marginTop: 6,
              marginBottom: 0,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              fontSize: 11,
              lineHeight: 1.35,
              opacity: 0.95,
            }}
          >
            {safeStringify(tip.row.raw, 2, 1200)}
          </pre>
        </div>
      )}
    </div>
  );
}

function safeStringify(obj, space = 2, maxLen = 1200) {
  let s = "";
  try {
    s = JSON.stringify(obj, null, space);
  } catch {
    s = String(obj);
  }
  if (s.length > maxLen) return s.slice(0, maxLen) + "\n... (truncated)";
  return s;
}
