// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import ModelFlow from "./components/ModelFlow.jsx";
import InfoHint from "./components/InfoHint.jsx";
import FeatureInsights from "./components/FeatureInsights";
import FeatureImportanceChart from "./components/FeatureImportanceChart.jsx";
const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard"); // ⬅️ 全頁分頁：預設是主介面
  const [loading, setLoading] = useState(false);
  const [imgs, setImgs] = useState([]); // 後端 artifacts 的所有圖檔 URL
  const [summary, setSummary] = useState(null);
  const [log, setLog] = useState([]);
  const [fastMode, setFastMode] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [showRawSummary, setShowRawSummary] = useState(false);

  // ✅ 新增：避免圖表容器尚未算出尺寸就 render，導致 width/height = -1
  const [showCharts, setShowCharts] = useState(false);

  // 目前顯示的圖種（forecast/backtest）
  const [figTab, setFigTab] = useState("forecast");

  // [TEMP DEBUG] 進頁就試抓 summary.json 並把關鍵資訊印到 Console
  useEffect(() => {
    const url = `${API}/artifacts/summary.json?t=${Date.now()}`;
    console.log("[DBG] try fetch:", url);
    fetch(url, { cache: "no-store" })
      .then((r) =>
        r.ok
          ? r.json()
          : Promise.reject(
              new Error(
                `HTTP ${r.status} ${r.headers.get("content-type") || ""}`
              )
            )
      )
      .then((j) => {
        console.log("[DBG] summary top keys:", Object.keys(j).slice(0, 20));

        // ✅ 修正：summary.json 最外層不一定有 single_anchor，改成更可靠的解析方式
        const singleAnchor =
          j?.single_anchor ??
          j?.single_anchor_eval ??
          j?.metrics?.single_anchor ??
          j?.data_model?.single_anchor ??
          null;

        console.log("[DBG] single_anchor(resolved):", singleAnchor);
      })
      .catch((err) => {
        console.error("[DBG] fetch error:", err);
      });
  }, []); // 放在元件內；避免 Invalid hook call

  useEffect(() => {
    const hasTop20 =
      Array.isArray(summary?.features?.main_top20) &&
      summary.features.main_top20.length > 0;

    if (!hasTop20) {
      setShowCharts(false);
      return;
    }

    const t = setTimeout(() => setShowCharts(true), 0);
    return () => clearTimeout(t);
  }, [summary]);

  const run = async () => {
    setLoading(true);
    setImgs([]);
    setSummary(null);
    setLog([]);
    setShowCharts(false); // ✅ 新增：跑新的結果時先關掉圖表，避免舊 layout 干擾

    try {
      // ① 呼叫後端 /run
      const res = await fetch(`${API}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fast_mode: fastMode }),
      });

      // ② 如果 HTTP 狀態碼不是 200，先把文字印出來方便 debug
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[/run] HTTP error:", res.status, text);
        window.alert(`後端執行失敗（HTTP ${res.status}）。請看 Console / Log。`);
        return;
      }

      const data = await res.json();

      // ③ 圖檔（加上 cache-busting）
      const urls = (data.artifacts || [])
        .filter((n) => typeof n === "string" && n.endsWith(".png"))
        .map((n) => `${API}/artifacts/${n}?t=${Date.now()}`);
      setImgs(urls);

      // ④ 先用 /run 回傳的 summary 當 base
      let mergedSummary = data.summary || null;

      // ⑤ 再試著讀 artifacts/summary.json，把兩邊 merge（檔案內容優先）
      try {
        const s = await fetch(`${API}/artifacts/summary.json?t=${Date.now()}`, {
          cache: "no-store",
        });
        if (s.ok) {
          const fresh = await s.json();
          mergedSummary = {
            ...(data.summary || {}),
            ...fresh,
            features: {
              ...(data.summary?.features || {}),
              ...(fresh?.features || {}),
            },
          };
        }
      } catch (err) {
        console.warn(
          "[run] 讀取 artifacts/summary.json 失敗，改用 /run 回傳的 summary：",
          err
        );
      }
      if (mergedSummary && data.summary?.features && !mergedSummary.features) {
        mergedSummary = { ...mergedSummary, features: data.summary.features };
      }

      if (mergedSummary) {
        setSummary(mergedSummary);
      }

      // ⑥ Log
      setLog([...(data.stderr_tail || []), ...(data.stdout_tail || [])]);

      if (!data.ok) {
        window.alert("後端執行失敗，請檢查下方 Log");
      }
    } catch (e) {
      console.error("[run] 呼叫 /run 失敗：", e);
      window.alert("呼叫後端失敗（可能是後端沒啟動，請檢查 uvicorn）");
    } finally {
      setLoading(false);
    }
  };

  const kpis = useMemo(() => {
    const s = summary || {};

    // RMSE 優先讀 single_anchor，其次 single_anchor_eval，再其次 metrics
    const rmse1 =
      s?.single_anchor?.rmse_1M ??
      s?.single_anchor_eval?.rmse_1m ??
      s?.metrics?.rmse_1m;

    const rmse3 =
      s?.single_anchor?.rmse_3M ??
      s?.single_anchor_eval?.rmse_3m ??
      s?.metrics?.rmse_3m;

    // 交易數 / 勝率：優先用 fsm_1m / fsm_3m，如果有 headline 欄位也支援
    const n1 = s?.fsm_1m?.n_trades ?? s?.trades_1m ?? 0;
    const n3 = s?.fsm_3m?.n_trades ?? s?.trades_3m ?? 0;
    const wr1 = s?.fsm_1m?.win_rate ?? s?.winrate_1m;
    const wr3 = s?.fsm_3m?.win_rate ?? s?.winrate_3m;

    return [
      {
        label: (
          <InfoHint label={<span>RMSE (1M)</span>}>
            <b>RMSE（1M）</b>：以最近 1 個月的「實際 vs. 預測」計算之均方根誤差；
            <u>越小越好</u>。可用來衡量模型短期準確度。
          </InfoHint>
        ),
        value: Number.isFinite(rmse1) ? rmse1.toFixed(2) : "—",
      },
      {
        label: (
          <InfoHint label={<span>RMSE (3M)</span>}>
            <b>RMSE（3M）</b>：以最近 3 個月的「實際 vs. 預測」計算之均方根誤差；
            <u>越小越好</u>。觀察較長區間的穩定度。
          </InfoHint>
        ),
        value: Number.isFinite(rmse3) ? rmse3.toFixed(2) : "—",
      },
      {
        label: (
          <InfoHint label={<span>交易數 (1M)</span>}>
            <b>交易數（1M）</b>：FSM 策略在近 1 個月完成的交易筆數（含進出場）。
            代表策略啟動頻率；交易過少可能代表條件嚴格或行情不活躍。
          </InfoHint>
        ),
        value: n1 ?? "—",
      },
      {
        label: (
          <InfoHint label={<span>交易數 (3M)</span>}>
            <b>交易數（3M）</b>：FSM 策略在近 3 個月完成的交易筆數。
            可搭配勝率與報酬率一起解讀。
          </InfoHint>
        ),
        value: n3 ?? "—",
      },
      {
        label: (
          <InfoHint label={<span>勝率 (1M)</span>}>
            <b>勝率（1M）</b>：近 1 個月所有交易中「獲利單」的比例。
            勝率高不一定代表賺錢，需搭配報酬/風險比與樣本數判讀。
          </InfoHint>
        ),
        value: Number.isFinite(wr1) ? `${(wr1 * 100).toFixed(0)}%` : "—",
      },
      {
        label: (
          <InfoHint label={<span>勝率 (3M)</span>}>
            <b>勝率（3M）</b>：近 3 個月的交易勝率。
            觀察較長期間的穩定度；同樣需搭配獲利/虧損幅度評估。
          </InfoHint>
        ),
        value: Number.isFinite(wr3) ? `${(wr3 * 100).toFixed(0)}%` : "—",
      },
    ];
  }, [summary]);

  // —— 圖檔自動分類（打分制）——
  const figureMap = useMemo(() => {
    const F_KEYS = [
      "predict",
      "future",
      "next",
      "forecast_next",
      "freeze_exog",
      "proj",
    ];
    const B_KEYS = [
      "vs",
      "actual",
      "rmse",
      "backtest",
      "trigger",
      "hist",
      "train",
      "figure",
    ];

    const score = (name) => {
      const n = name.toLowerCase();
      let f = 0,
        b = 0;
      if (F_KEYS.some((k) => n.includes(k))) f += 3;
      if (B_KEYS.some((k) => n.includes(k))) b += 3;
      if (/\b0?2\b/.test(n)) f += 2;
      if (/\b0?1\b/.test(n)) b += 2;
      return { f, b };
    };

    const items = (imgs || [])
      .map((u) => {
        let filename = "";
        try {
          filename = new URL(u).pathname.split("/").pop() || "";
        } catch {
          const parts = u.split("/");
          filename = parts[parts.length - 1] || "";
        }
        return { url: u, name: filename };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    let forecast = null,
      backtest = null;
    for (const it of items) {
      const { f, b } = score(it.name);
      if (f > b && !forecast) {
        forecast = it.url;
        continue;
      }
      if (b > f && !backtest) {
        backtest = it.url;
        continue;
      }
    }

    // 後備：兩張圖常見 01(回測)/02(預測)
    if ((!forecast || !backtest) && items.length === 2) {
      const [a, b] = items;
      const a02 = /(^|[^0-9])0?2([^0-9]|$)/.test(a.name.toLowerCase());
      const b02 = /(^|[^0-9])0?2([^0-9]|$)/.test(b.name.toLowerCase());
      if (!forecast) forecast = a02 ? a.url : b02 ? b.url : b.url;
      if (!backtest) backtest = a02 ? b.url : a.url;
    }

    // 最後保底
    if (!forecast && items[1]) forecast = items[1].url;
    if (!backtest && items[0]) backtest = items[0].url;

    return { forecast, backtest };
  }, [imgs]);

  // 新圖載入時預設先看「預測圖」，沒有就看回測圖
  useEffect(() => {
    if (figureMap.forecast) setFigTab("forecast");
    else if (figureMap.backtest) setFigTab("backtest");
  }, [figureMap.forecast, figureMap.backtest]);

  const currentImg =
    figTab === "forecast" ? figureMap.forecast : figureMap.backtest;

  // ==========================
  //          JSX
  // ==========================
  return (
    <div className="page">
      {/* Header */}
      <header className="header">
        {/* 左邊：Logo + 標題 */}
        <div className="titleWithLogo">
          <img
            src={`${import.meta.env.BASE_URL}logo.png`}
            alt="TSMC logo"
            className="tsmcLogo"
          />
          <div>
            <h1>TSMC 股價預測</h1>
            <p className="subtle">API_BASE = {API}</p>
          </div>
        </div>

        {/* 右邊：模式 badge */}
        <div className="mode">
          <span className={`badge ${fastMode ? "on" : "off"}`}>
            {fastMode ? "FAST MODE" : "FULL MODE"}
          </span>
        </div>
      </header>

      {/* 🔻🔻 全頁分頁切換列 🔻🔻 */}
      <div className="tab-bar">
        <button
          className={`tab ${activeTab === "dashboard" ? "active" : ""}`}
          onClick={() => setActiveTab("dashboard")}
        >
          預測儀表板
        </button>
        <button
          className={`tab ${activeTab === "flow" ? "active" : ""}`}
          onClick={() => setActiveTab("flow")}
        >
          模型流程說明
        </button>
        {/* ✅ 新增：模式說明分頁按鈕 */}
        <button
          className={`tab ${activeTab === "mode" ? "active" : ""}`}
          onClick={() => setActiveTab("mode")}
        >
          模式說明
        </button>
      </div>
      {/* 🔺🔺 全頁分頁切換列 🔺🔺 */}

      {/* ========== 分頁一：原本的主畫面（全部包在 activeTab === "dashboard" 裡） ========== */}
      {activeTab === "dashboard" && (
        <>
          {/* Toolbar */}
          <section className="toolbar card">
            <label className="checkbox">
              <input
                type="checkbox"
                checked={fastMode}
                onChange={(e) => setFastMode(e.target.checked)}
              />
              <span>使用極速模式（FAST_MODE）</span>
            </label>

            <button className="primary" onClick={run} disabled={loading}>
              {loading ? (
                <span className="spinner" aria-hidden="true" />
              ) : (
                <span className="rocket" aria-hidden="true">
                  🚀
                </span>
              )}
              {loading ? "執行中..." : "執行預測"}
            </button>
          </section>

          {/* 圖區：單張大圖 + 分段切換 */}
          <section>
            <div className="rowBetween">
              <h2>視覺化結果</h2>
              <div className="segmented">
                <button
                  className={`segBtn ${figTab === "forecast" ? "active" : ""}`}
                  onClick={() => setFigTab("forecast")}
                  disabled={!figureMap.forecast}
                  title={figureMap.forecast ? "" : "沒有可用的預測圖"}
                >
                  預測圖
                </button>
                <button
                  className={`segBtn ${figTab === "backtest" ? "active" : ""}`}
                  onClick={() => setFigTab("backtest")}
                  disabled={!figureMap.backtest}
                  title={figureMap.backtest ? "" : "沒有可用的回測圖"}
                >
                  回測圖
                </button>
              </div>
            </div>

            {!currentImg ? (
              <div className="empty card">
                <p>尚未產生圖表。請點「執行預測」。</p>
              </div>
            ) : (
              <a
                className="bigImg card"
                href={currentImg}
                target="_blank"
                rel="noreferrer"
              >
                <img src={currentImg} alt={`figure-${figTab}`} />
              </a>
            )}
          </section>

          {/* 摘要 */}
          <section>
            <h2>摘要</h2>
            {!summary ? (
              <div className="empty card">
                <p>尚未有摘要資料。</p>
              </div>
            ) : (
              <>
                <div className="kpiGrid">
                  {kpis.map((k, i) => (
                    <div key={i} className="kpi card">
                      <div className="kpiLabel">{k.label}</div>
                      <div className="kpiValue">{k.value}</div>
                    </div>
                  ))}
                </div>

                {Array.isArray(summary?.monthly_extrema) &&
                  summary.monthly_extrema.length > 0 && (
                    <div className="card tableCard">
                      <div className="tableHead">
                        <div>月份</div>
                        <div>預測高點日期</div>
                        <div>高點價</div>
                        <div>預測低點日期</div>
                        <div>低點價</div>
                      </div>
                      {summary.monthly_extrema.map((r, i) => (
                        <div className="tableRow" key={i}>
                          <div>{r.Month}</div>
                          <div>{r.hi_date}</div>
                          <div>{Number(r.hi_price)?.toFixed?.(2) ?? r.hi_price}</div>
                          <div>{r.lo_date}</div>
                          <div>{Number(r.lo_price)?.toFixed?.(2) ?? r.lo_price}</div>
                        </div>
                      ))}
                    </div>
                  )}
              </>
            )}
          </section>

          {/* 未來三個月每日股價預測 */}
          <section>
            <h2>未來三個月每日預測價格</h2>

            {!summary ||
            !Array.isArray(summary.future_3m_daily) ||
            summary.future_3m_daily.length === 0 ? (
              <div className="empty card">
                <p>尚未有每日預測資料。</p>
              </div>
            ) : (
              <div className="card tableCard">
                <div
                  className="tableHead"
                  style={{ gridTemplateColumns: "1.5fr 1.5fr" }}
                >
                  <div>日期</div>
                  <div>預測收盤價</div>
                </div>

                <div style={{ maxHeight: 260, overflowY: "auto" }}>
                  {summary.future_3m_daily.map((d, i) => (
                    <div
                      key={i}
                      className="tableRow"
                      style={{ gridTemplateColumns: "1.5fr 1.5fr" }}
                    >
                      <div>{d.date}</div>
                      <div>{Number(d.pred_close)?.toFixed?.(2) ?? d.pred_close}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ★★★ 特徵值說明（只綁定這一次的 summary） ★★★ */}
          <section>
            <h2>特徵值與重要性</h2>

            {!summary ||
            !Array.isArray(summary?.features?.main_top20) ||
            summary.features.main_top20.length === 0 ? (
              <div className="empty card">
                <p>尚未執行預測，暫無特徵重要性資料。</p>
              </div>
            ) : (
              <div className="card" style={{ padding: 16, minHeight: 360, overflow: "visible" }}>
                {showCharts ? (
                  <FeatureImportanceChart data={summary.features.main_top20} />
                ) : (
                  <div style={{ opacity: 0.7 }}>圖表載入中…</div>
                )}

              </div>
            )}
          </section>
          <footer className="footer">
            <span>© {new Date().getFullYear()} — Demo UI</span>
          </footer>
        </>
      )}

      {activeTab === "flow" && (
        <section className="card" style={{ marginTop: 16, padding: "24px 40px" }}>
          <ModelFlow />
        </section>
      )}

      {/* ✅ ========== 分頁三：模式說明 ========== */}
      {activeTab === "mode" && (
        <section className="card" style={{ marginTop: 16, padding: "24px 40px" }}>
          <div style={{ padding: "16px", lineHeight: 1.6 }}>
            <h2 style={{ marginTop: 0 }}>FAST MODE 與 FULL MODE 模式說明</h2>

            <p style={{ marginTop: 8 }}>
              這個頁面簡單說明「急速模式（FAST_MODE）」和「完整模式」的差別，
              幫助你決定什麼情境要用哪一種。
            </p>

            <ol className="flowList" style={{ marginTop: 16 }}>
              <li>
                <b>急速模式（FAST_MODE）：追求速度</b>
                <ul>
                  <li>跳過較耗時的超參數搜尋，只使用事先設定好的 XGBoost 參數。</li>
                  <li>訓練與預測流程較精簡，重點是「快速產出新預測結果」。</li>
                  <li>適合平常想快速看最新走勢、常常按「執行預測」的情境。</li>
                </ul>
              </li>

              <li style={{ marginTop: 8 }}>
                <b>完整模式（關閉 FAST_MODE）：追求穩定與精細</b>
                <ul>
                  <li>會開啟較完整的訓練流程，例如調整模型超參數與做更多檢查。</li>
                  <li>計算時間比急速模式長，但有機會讓模型在近期資料上更貼近。</li>
                  <li>適合要做報告、重訓模型或想仔細評估模型表現時使用。</li>
                </ul>
              </li>

              <li style={{ marginTop: 8 }}>
                <b>如何選擇？</b>
                <ul>
                  <li>平常看盤、想快快看結果 → 建議用「急速模式」（預設勾選）。</li>
                  <li>要重新調整模型、做較正式的分析 → 建議關掉 FAST_MODE，用完整模式。</li>
                </ul>
              </li>
            </ol>
          </div>
        </section>
      )}
    </div>
  );
}
