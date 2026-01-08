// src/components/FeatureInsights.jsx
import React, { useMemo } from "react";
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
 *   [{ feature: 'XXX', value: <數值> }, ...]
 * 目前只固定使用 XGBoost Gain
 */
function normalizeData(features) {
  if (!features) return [];

  // ---------- 新格式 main_top20 ----------
  if (features.main_top20) {
    const src = features.main_top20 ?? [];
    return src
      .map((d) => ({
        feature: d.feature || d.name,
        value: Number(d.gain ?? 0),
      }))
      .filter((d) => d.feature && Number.isFinite(d.value));
  }

  // ---------- 舊格式 items[] ----------
  if (Array.isArray(features.items)) {
    const src = features.items;
    return src
      .map((d) => ({
        feature: d.feature || d.name,
        value: Number(d.gain ?? 0),
      }))
      .filter((d) => d.feature && Number.isFinite(d.value));
  }

  return [];
}

function fmt(v) {
  if (!Number.isFinite(v)) return "-";
  return v >= 1000 ? v.toFixed(0) : v.toFixed(4);
}

/**
 * ✅ 只使用父層傳進來的 summary.features
 *    固定用 XGBoost Gain，顯示前 10 名
 */
function FeatureInsights({ features, title = "特徵值與重要性" }) {
  // rows: [{ feature, value, pct }]
  const rows = useMemo(() => {
    const arr = normalizeData(features);

    // 先照原始 value 排序（大 → 小）
    arr.sort((a, b) => b.value - a.value);

    // 總和用來換算百分比（仍用全部特徵之和）
    const total = arr.reduce(
      (s, d) => s + (Number.isFinite(d.value) ? d.value : 0),
      0
    );

    // 只取前 10 名
    const top10 = arr.slice(0, 10);

    return top10.map((d) => ({
      feature: d.feature,
      value: d.value,
      pct:
        total > 0 && Number.isFinite(d.value)
          ? (d.value / total) * 100
          : 0,
    }));
  }, [features]);

  // 給圖表用的資料
  const chartData = useMemo(
    () =>
      rows.map((d) => ({
        name: d.feature,
        importance: d.pct, // 用百分比當長度
        raw: d.value, // 原始 Gain 值（現在 tooltip 不再顯示）
      })),
    [rows]
  );

  return (
    <section>
      <h2>{title}</h2>

      {!features || rows.length === 0 ? (
        // 🔹 空狀態：拿掉 card，只保留文字 + 一點內距
        <div
          className="empty"
          style={{ padding: "20px 16px", borderRadius: 12 }}
        >
          <p>尚未執行預測，暫無特徵重要性資料。</p>
        </div>
      ) : (
        // 🔹 內容區：也不再使用 .card，外層的 CollapsibleSection 會負責外框
        <div style={{ padding: "12px 8px 0 8px" }}>
          {/* 上方文字說明 */}
          <p
            className="subtle"
            style={{ marginBottom: 12, fontSize: 13, lineHeight: 1.6 }}
          >
            圖中顯示的是前 <b>10 名</b> 特徵的
            <b> 相對重要度（%）</b>，指標來源固定為{" "}
            <b>XGBoost Gain</b>。
          </p>

          {/* 圖表本體 */}
          <div style={{ width: "100%", height: 380 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 80, right: 40, top: 10, bottom: 10 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  tickFormatter={(v) =>
                    Number.isFinite(v) ? `${v.toFixed(1)}%` : v
                  }
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fontSize: 12 }}
                />

                {/* 🎯 Tooltip：只顯示中文名稱 + 相對重要度 + 簡短說明 */}
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload || !payload.length) return null;
                    const p = payload[0];
                    const key = p.payload?.name;
                    const meta = getFeatureMeta(key);
                    const pct = Number(p.value);
                    const pctStr = Number.isFinite(pct)
                      ? `${pct.toFixed(2)}%`
                      : "-";

                    return (
                      <div
                        style={{
                          background: "#ffffff",
                          border: "1px solid #e5e7eb",
                          borderRadius: 8,
                          padding: "8px 10px",
                          boxShadow:
                            "0 8px 20px rgba(15, 23, 42, 0.12)",
                          maxWidth: 260,
                          fontSize: 12,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            marginBottom: 6,
                            fontSize: 13,
                          }}
                        >
                          {meta.zh}
                        </div>
                        <div style={{ marginBottom: 4 }}>
                          相對重要度：<b>{pctStr}</b>
                        </div>
                        <div
                          style={{
                            color: "#4b5563",
                            lineHeight: 1.4,
                          }}
                        >
                          {meta.desc}
                        </div>
                      </div>
                    );
                  }}
                />

                {/* 藍色條狀圖 */}
                <Bar
                  dataKey="importance"
                  radius={[4, 4, 4, 4]}
                  fill="#60a5fa"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* 下方補充說明 */}
          <p
            className="subtle"
            style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6 }}
          >
            說明：這裡顯示的是「相對重要度％」，會先把所有特徵的
            XGBoost Gain 加總，再換算成百分比。畫面目前只列出前 10
            名特徵，但百分比仍然是相對於「全部特徵」。把滑鼠移到條狀上，可以看到對應的
            <b> 中文名稱與簡短說明</b>。
          </p>
        </div>
      )}
    </section>
  );
}

export default FeatureInsights;
