// src/components/FeatureInsights.jsx
import React, { useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

/**
 * 每個特徵的「中文名稱 + 簡短說明」
 */
const FEATURE_META = {
  Foreign_big_sell: {
    zh: "外資單日賣超",
    desc: "外資當日賣超（金額或張數），代表國際資金的賣壓強度。",
  },
  TSM_return: {
    zh: "台積電當日報酬",
    desc: "台積電股價相對前一交易日的漲跌幅，用來反映當日走勢。",
  },
  TSM_gap_return: {
    zh: "台積電跳空報酬",
    desc: "開盤價相對前一日收盤價的變動幅度，觀察是否有跳空缺口。",
  },
  ret_1d: {
    zh: "1 日報酬",
    desc: "標的在 1 個交易日的報酬率，作為最短期動能指標之一。",
  },
  SOX_return: {
    zh: "費半指數報酬",
    desc: "費城半導體指數的當日報酬，反映整體半導體族群景氣。",
  },
  range20_ratio: {
    zh: "20 日區間位置",
    desc: "股價位於近 20 日高低區間中的相對位置，接近 1 代表偏高。",
  },
  ret_5d: {
    zh: "5 日報酬",
    desc: "過去 5 個交易日的累積報酬率，用來看一週左右的趨勢。",
  },
  pos_3M: {
    zh: "3 個月相對位置",
    desc: "股價在近 3 個月區間內的大致位置，偏高或偏低。",
  },
  return_lag1: {
    zh: "前一期報酬",
    desc: "上一期（通常是前一日）的報酬率，作為動能的延續指標。",
  },
  gap_5d: {
    zh: "5 日缺口幅度",
    desc: "近 5 日內跳空缺口的相關變化，反映價格急動情形。",
  },
};

/** 找不到對應 key 時的預設說明 */
function getFeatureMeta(key) {
  return (
    FEATURE_META[key] || {
      zh: key,
      desc: "此特徵對模型預測有一定影響，數值越大代表相對重要度越高。",
    }
  );
}

/**
 * 把後端丟來的 features 正規化成：
 *   [{ feature: 'XXX', gain: <數值>, perm_rmse: <數值> }, ...]
 *
 * 支援：
 * - 直接陣列：[{ name, gain, perm_rmse }, ...]   ← 你現在 summary.features 的格式
 * - 新格式：{ main_top20: [...] }
 * - 舊格式：{ items: [...] }
 */
function normalizeData(features) {
  if (!features) return [];

  // ✅ 先處理「直接就是陣列」的情況（現在 summary.features 就是這種）
  if (Array.isArray(features)) {
    return features
      .map((d) => ({
        feature: d.feature || d.name,
        gain: Number(d.gain ?? 0),
        perm_rmse: Number(d.perm_rmse ?? 0),
      }))
      .filter(
        (d) =>
          d.feature &&
          (Number.isFinite(d.gain) || Number.isFinite(d.perm_rmse))
      );
  }

  // ---------- 新格式 main_top20 ----------
  if (Array.isArray(features.main_top20)) {
    return features.main_top20
      .map((d) => ({
        feature: d.feature || d.name,
        gain: Number(d.gain ?? 0),
        perm_rmse: Number(d.perm_rmse ?? 0),
      }))
      .filter(
        (d) =>
          d.feature &&
          (Number.isFinite(d.gain) || Number.isFinite(d.perm_rmse))
      );
  }

  // ---------- 舊格式 items[] ----------
  if (Array.isArray(features.items)) {
    return features.items
      .map((d) => ({
        feature: d.feature || d.name,
        gain: Number(d.gain ?? 0),
        perm_rmse: Number(d.perm_rmse ?? 0),
      }))
      .filter(
        (d) =>
          d.feature &&
          (Number.isFinite(d.gain) || Number.isFinite(d.perm_rmse))
      );
  }

  return [];
}
/** 🧱 小工具：把數值夾在 [min, max] 之間 */
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}
function FeatureInsights({ summary, features, title = "特徵值與重要性" }) {
  /**
   * 🔑 核心修正點：特徵來源優先順序
   *
   * 1. 優先用 summary.features（你現在的 summary.json 一定有）
   * 2. 其次 summary.features_block.items
   * 3. 再來才用 props.features / features.items
   *
   * 這樣就不會被一個怪怪的 features prop 蓋掉真正有資料的 summary.features。
   */
  const resolvedFeatures =
    (summary && Array.isArray(summary.features) && summary.features) ||
    (summary &&
      summary.features_block &&
      Array.isArray(summary.features_block.items) &&
      summary.features_block.items) ||
    (features && Array.isArray(features) && features) ||
    (features &&
      typeof features === "object" &&
      Array.isArray(features.items) &&
      features.items) ||
    null;

  // 抓圖表容器位置
  const chartWrapRef = useRef(null);

  // 記錄最後一次滑鼠在圖表內的位置（避免 Recharts 的 coordinate 偶發 undefined）
  const lastMouseRef = useRef({ x: 0, y: 0 });

  /**
   * 自動挑 metric：
   * - 若 gain 全部為 0（或幾乎為 0），就改用 perm_rmse
   * - 否則使用 gain
   */
  const metric = useMemo(() => {
    const arr = normalizeData(resolvedFeatures);
    if (!arr.length) return "gain";

    const gainSum = arr.reduce(
      (s, d) => s + (Number.isFinite(d.gain) ? d.gain : 0),
      0
    );
    const permSum = arr.reduce(
      (s, d) => s + (Number.isFinite(d.perm_rmse) ? d.perm_rmse : 0),
      0
    );

    if (gainSum <= 1e-12 && permSum > 0) return "perm_rmse";
    return "gain";
  }, [resolvedFeatures]);

  // rows: [{ feature, pct, raw_gain, raw_perm_rmse }]
  const rows = useMemo(() => {
    const arr = normalizeData(resolvedFeatures);
    const valueOf = (d) => (metric === "perm_rmse" ? d.perm_rmse : d.gain);

    const sorted = [...arr].sort((a, b) => {
      const va = Number.isFinite(valueOf(a)) ? valueOf(a) : 0;
      const vb = Number.isFinite(valueOf(b)) ? valueOf(b) : 0;
      return vb - va;
    });

    const total = sorted.reduce((s, d) => {
      const v = valueOf(d);
      return s + (Number.isFinite(v) ? v : 0);
    }, 0);

    const top10 = sorted.slice(0, 10);

    return top10.map((d) => {
      const v = valueOf(d);
      return {
        feature: d.feature,
        pct: total > 0 && Number.isFinite(v) ? (v / total) * 100 : 0,
        raw_gain: Number.isFinite(d.gain) ? d.gain : 0,
        raw_perm_rmse: Number.isFinite(d.perm_rmse) ? d.perm_rmse : 0,
      };
    });
  }, [resolvedFeatures, metric]);

  const chartData = useMemo(
    () =>
      rows.map((d) => ({
        name: d.feature,
        importance: d.pct,
        raw_gain: d.raw_gain,
        raw_perm_rmse: d.raw_perm_rmse,
      })),
    [rows]
  );

  return (
    <section style={{ position: "relative" }}>
      <h2>{title}</h2>

      {!resolvedFeatures || rows.length === 0 ? (
        <div className="empty" style={{ padding: "20px 16px", borderRadius: 12 }}>
          <p>尚未執行預測，暫無特徵重要性資料。</p>
        </div>
      ) : (
        <div style={{ padding: "12px 8px 0 8px" }}>
          <p
            className="subtle"
            style={{ marginBottom: 12, fontSize: 13, lineHeight: 1.6 }}
          >
            圖中顯示的是前 <b>10 名</b> 特徵的 <b>相對重要度（%）</b>，
            目前以{" "}
            <b>{metric === "gain" ? "XGBoost Gain" : "Permutation ΔRMSE"}</b>{" "}
            作為排序與換算基準。（百分比是相對於「全部特徵」的 {metric} 加總）
          </p>

          <div ref={chartWrapRef} style={{ width: "100%", height: 380 }}>
            <ResponsiveContainer width="100%" height="100%" debounce={80}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 110, right: 60, top: 10, bottom: 10 }}
                onMouseMove={(st) => {
                  const x = Number(st?.chartX);
                  const y = Number(st?.chartY);
                  if (Number.isFinite(x) && Number.isFinite(y)) {
                    lastMouseRef.current = { x, y };
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />

                <XAxis
                  type="number"
                  tickFormatter={(v) =>
                    Number.isFinite(v) ? `${Number(v).toFixed(1)}%` : v
                  }
                />

                <YAxis
                  type="category"
                  dataKey="name"
                  width={180}
                  tick={{ fontSize: 12 }}
                  tickFormatter={(key) => getFeatureMeta(key).zh}
                />

                <Tooltip
                  cursor={{ fill: "rgba(148, 163, 184, 0.18)" }}
                  wrapperStyle={{ zIndex: 9999, pointerEvents: "none" }}
                  content={({ active, payload, coordinate }) => {
                    if (!active || !payload || !payload.length) return null;
                    if (typeof document === "undefined") return null;

                    const d = payload[0]?.payload;
                    const key = d?.name;
                    const meta = getFeatureMeta(key);

                    const pct = Number(d?.importance);
                    const pctStr = Number.isFinite(pct) ? `${pct.toFixed(2)}%` : "-";

                    const rawGain = Number(d?.raw_gain);
                    const rawPerm = Number(d?.raw_perm_rmse);

                    const rawGainStr = Number.isFinite(rawGain)
                      ? rawGain.toFixed(6)
                      : "-";
                    const rawPermStr = Number.isFinite(rawPerm)
                      ? rawPerm.toFixed(6)
                      : "-";

                    const cx =
                      Number(coordinate?.x) ||
                      Number(lastMouseRef.current?.x) ||
                      0;
                    const cy =
                      Number(coordinate?.y) ||
                      Number(lastMouseRef.current?.y) ||
                      0;

                    const rect = chartWrapRef.current?.getBoundingClientRect?.();
                    const baseLeft = rect ? rect.left : 0;
                    const baseTop = rect ? rect.top : 0;

                    const offsetX = 14;
                    const offsetY = 14;

                    const tipW = 330;
                    const tipH = 220;

                    const rawLeft = baseLeft + cx + offsetX;
                    const rawTop = baseTop + cy + offsetY;

                    const vw = window.innerWidth || 1200;
                    const vh = window.innerHeight || 800;

                    const left = clamp(rawLeft, 8, Math.max(8, vw - tipW - 8));
                    const top = clamp(rawTop, 8, Math.max(8, vh - tipH - 8));

                    return createPortal(
                      <div
                        style={{
                          position: "fixed",
                          left,
                          top,
                          zIndex: 999999,
                          pointerEvents: "none",
                        }}
                      >
                        <div
                          style={{
                            background: "#ffffff",
                            border: "1px solid #e5e7eb",
                            borderRadius: 10,
                            padding: "10px 12px",
                            boxShadow: "0 10px 24px rgba(15, 23, 42, 0.16)",
                            maxWidth: 320,
                            fontSize: 12,
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 800,
                              marginBottom: 6,
                              fontSize: 13,
                            }}
                          >
                            {meta.zh}
                          </div>

                          <div style={{ marginBottom: 6 }}>
                            相對重要度：<b>{pctStr}</b>
                          </div>

                          <div style={{ marginBottom: 2 }}>
                            Gain：<b>{rawGainStr}</b>
                          </div>

                          <div style={{ marginBottom: 8 }}>
                            ΔRMSE：<b>{rawPermStr}</b>
                          </div>

                          <div style={{ color: "#4b5563", lineHeight: 1.45 }}>
                            {meta.desc}
                          </div>

                          <div
                            style={{
                              marginTop: 8,
                              color: "#6b7280",
                              fontSize: 11,
                              lineHeight: 1.35,
                            }}
                          >
                            註：% 以全部特徵 {metric} 加總換算；圖表僅顯示前 10 名。
                          </div>
                        </div>
                      </div>,
                      document.body
                    );
                  }}
                />

                <Bar
                  dataKey="importance"
                  radius={[6, 6, 6, 6]}
                  fill="#60a5fa"
                  minPointSize={2}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <p className="subtle" style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6 }}>
            說明：這裡顯示的是「相對重要度％」，會先把所有特徵的{" "}
            <b>{metric === "gain" ? "XGBoost Gain" : "Permutation ΔRMSE"}</b>{" "}
            加總，再換算成百分比。畫面目前只列出前 10 名特徵，但百分比仍然是相對於
            「全部特徵」。把滑鼠移到條狀上，可以看到對應的
            <b> 中文名稱、相對重要度、原始 Gain 與 ΔRMSE</b>。
          </p>
        </div>
      )}
    </section>
  );
}

export default FeatureInsights;
