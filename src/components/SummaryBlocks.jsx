import React from "react";
import InfoHint from "./InfoHint";

// ---------- JSON → 摘要 ----------
function buildJsonSummary(data) {
  const sa = data?.single_anchor ?? {};
  const f1 = data?.fsm_1m ?? data?.fsm_1M ?? {};
  const f3 = data?.fsm_3m ?? data?.fsm_3M ?? {};
  const me = Array.isArray(data?.monthly_extrema) ? data.monthly_extrema : [];

  const months = me.slice(0, 4).map((m) => ({
    month: m?.Month ?? m?.month ?? "",
    hi: m?.hi_date ?? "",
    hi_px: Number(m?.hi_price ?? NaN),
    lo: m?.lo_date ?? "",
    lo_px: Number(m?.lo_price ?? NaN),
  }));

  return {
    anchorDate: sa?.anchor_eval ?? sa?.anchor_date,
    rmse1M: Number(sa?.rmse_1M ?? sa?.rmse1M ?? NaN),
    rmse3M: Number(sa?.rmse_3M ?? sa?.rmse3M ?? NaN),
    fsm1M: {
      n_trades: Number(f1?.n_trades ?? 0),
      win_rate: Number(f1?.win_rate ?? 0),
      avg_trade_ret_pct: Number(f1?.avg_trade_ret_pct ?? 0),
      total_ret_pct: Number(f1?.total_ret_pct ?? 0),
    },
    fsm3M: {
      n_trades: Number(f3?.n_trades ?? 0),
      win_rate: Number(f3?.win_rate ?? 0),
      avg_trade_ret_pct: Number(f3?.avg_trade_ret_pct ?? 0),
      total_ret_pct: Number(f3?.total_ret_pct ?? 0),
    },
    months,
    figuresCount: Array.isArray(data?.figures) ? data.figures.length : 0,
  };
}

// ---------- Log → 摘要 ----------
function buildLogSummary(raw) {
  raw = String(raw ?? "");
  const sampleDates = Array.from(raw.matchAll(/\n(\d{4}-\d{2}-\d{2})\s+\d{4}\.\d+/g))
    .slice(0, 8)
    .map((m) => m[1]);

  let fsm3mTrade;
  const tableRow = raw.match(
    /(?<=\[FSM 3M 交易明細\][\s\S]*?\n)\s*(\d{4}-\d{2}-\d{2})\s+(\d{4}-\d{2}-\d{2})\s+([A-Z]+)\s+(\d+)\s+[-\d\.]+\s+([-\d\.]+)\s+([-\d\.]+)\s+([-\d\.]+)/
  );
  if (tableRow) {
    fsm3mTrade = {
      entry_date: tableRow[1],
      exit_date: tableRow[2],
      side: tableRow[3],
      hold_days: Number(tableRow[4]),
      entry_px: Number(tableRow[6]),
      exit_px: Number(tableRow[7]),
      ret_pct: Number(tableRow[5]),
    };
  }

  const dataLast = raw.match(/DATA_LAST\s*=\s*([0-9\-]+)/)?.[1];
  const anchor = raw.match(/ANCHOR_DATE\s*=\s*([0-9\-]+)/)?.[1];

  return { sampleDates, fsm3mTrade, data_last: dataLast, anchor_date: anchor };
}

// ---------- 版面 ----------
const card = {
  background: "#0b1220",
  color: "#e8f0ff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 8px 24px rgba(0,0,0,.25)",
};
const row = { display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" };

function pct(x) {
  const n = Number(x);
  return Number.isFinite(n) ? `${(n * 100).toFixed(2)}%` : "—";
}
function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n.toLocaleString() : "—";
}

function StatCard({ title, value, help }) {
  return (
    <div
      style={{
        background: "#0e1729",
        border: "1px solid #1f2a44",
        borderRadius: 12,
        padding: 16,
        boxShadow: "0 6px 16px rgba(0,0,0,.18)",
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <strong style={{ fontSize: 14 }}>
          <InfoHint label={<span style={{ fontWeight: 700 }}>{title}</span>}>
            {help}
          </InfoHint>
        </strong>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

export default function SummaryBlocks({ apiJson, rawLog }) {
  const J = buildJsonSummary(apiJson || {});
  const L = buildLogSummary(rawLog || "");

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* 區塊 0：摘要六格（可點擊說明） —— 新增 */}
      <section style={card}>
        <h3 style={{ margin: 0, fontSize: 18 }}>摘要（點擊每格右側 i 觀看說明）</h3>
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
          }}
        >
          <StatCard
            title="RMSE (1M)"
            value={num(J.rmse1M)}
            help={
              <>
                <b>RMSE（1M）</b>：根據「最近 1 個月」預測結果計算的均方根誤差。
                <br />數值越小代表模型在近 1 個月的預測越準。
              </>
            }
          />
          <StatCard
            title="RMSE (3M)"
            value={num(J.rmse3M)}
            help={
              <>
                <b>RMSE（3M）</b>：根據「最近 3 個月」預測結果計算的均方根誤差。
                <br />數值越小代表模型在近 3 個月的預測越準。
              </>
            }
          />
          <StatCard
            title="交易數 (1M)"
            value={num(J.fsm1M?.n_trades ?? 0)}
            help={
              <>
                <b>交易數（1M）</b>：FSM 策略在近 1 個月內完成的交易筆數（含進出場）。
                <br />交易多不代表一定更好，需搭配勝率與報酬觀察。
              </>
            }
          />
          <StatCard
            title="交易數 (3M)"
            value={num(J.fsm3M?.n_trades ?? 0)}
            help={
              <>
                <b>交易數（3M）</b>：FSM 策略在近 3 個月內的交易筆數。
                <br />可用來衡量策略在不同市場階段的啟動頻率。
              </>
            }
          />
          <StatCard
            title="勝率 (1M)"
            value={pct(J.fsm1M?.win_rate)}
            help={
              <>
                <b>勝率（1M）</b>：近 1 個月內所有交易中獲利單的比例。
                <br />勝率高不一定代表績效好，需同時看平均報酬與風險。
              </>
            }
          />
          <StatCard
            title="勝率 (3M)"
            value={pct(J.fsm3M?.win_rate)}
            help={
              <>
                <b>勝率（3M）</b>：近 3 個月內的交易勝率。
                <br />可觀察策略在較長區間的穩定度。
              </>
            }
          />
        </div>
      </section>

      {/* 區塊 A：JSON 摘要（保留原本） */}
      <section style={card}>
        <h3 style={{ margin: 0, fontSize: 18 }}>JSON 摘要</h3>
        <div style={{ marginTop: 8 }}>
          <div style={row}>
            <div>錨點日期：<b>{J.anchorDate ?? "—"}</b></div>
            <div>RMSE：1M <b>{num(J.rmse1M)}</b> ｜ 3M <b>{num(J.rmse3M)}</b></div>
          </div>

          <div style={{ marginTop: 8, ...row }}>
            <div>
              <div><b>FSM-1M</b></div>
              <small>筆數 {J.fsm1M?.n_trades ?? 0}、勝率 {pct(J.fsm1M?.win_rate)}、平均單筆 {pct(J.fsm1M?.avg_trade_ret_pct)}、累積 {pct(J.fsm1M?.total_ret_pct)}</small>
            </div>
            <div>
              <div><b>FSM-3M</b></div>
              <small>筆數 {J.fsm3M?.n_trades ?? 0}、勝率 {pct(J.fsm3M?.win_rate)}、平均單筆 {pct(J.fsm3M?.avg_trade_ret_pct)}、累積 {pct(J.fsm3M?.total_ret_pct)}</small>
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <div><b>月度相對高低點（前 4 筆）</b></div>
            <ul style={{ margin: "6px 0 0 18px" }}>
              {J.months.length ? J.months.map((m, i) => (
                <li key={i}>
                  {m.month}：高 {m.hi}（{num(m.hi_px)}）／低 {m.lo}（{num(m.lo_px)}）
                </li>
              )) : <li>（無資料）</li>}
            </ul>
          </div>

          <div style={{ marginTop: 8 }}>圖檔數：<b>{J.figuresCount}</b></div>
        </div>
      </section>

      {/* 區塊 B：Log 摘要（保留原本） */}
      <section style={card}>
        <h3 style={{ margin: 0, fontSize: 18 }}>Log 摘要</h3>
        <div style={{ marginTop: 8 }}>
          <div style={row}>
            <div>DATA_LAST：<b>{L.data_last ?? "—"}</b></div>
            <div>ANCHOR_DATE：<b>{L.anchor_date ?? "—"}</b></div>
          </div>

          <div style={{ marginTop: 8 }}>
            <div><b>資料期間（節錄日期）</b></div>
            <small>{L.sampleDates.length ? L.sampleDates.join("、") : "—"}</small>
          </div>

          <div style={{ marginTop: 8 }}>
            <div><b>FSM-3M 交易（示例 1 筆）</b></div>
            {L.fsm3mTrade ? (
              <small>
                {L.fsm3mTrade.entry_date} → {L.fsm3mTrade.exit_date}（{L.fsm3mTrade.side}、{L.fsm3mTrade.hold_days} 天）
                ，進 {num(L.fsm3mTrade.entry_px)}、出 {num(L.fsm3mTrade.exit_px)}，
                報酬 {pct(L.fsm3mTrade.ret_pct)}
              </small>
            ) : (
              <small>—</small>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
