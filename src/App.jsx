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
  const [imgs, setImgs] = useState([]); // 後端 artifacts 的所有圖檔 URL（保留：作為 fallback）
  const [summary, setSummary] = useState(null);
  const [log, setLog] = useState([]);
  const [fastMode, setFastMode] = useState(true);
  const [showLog, setShowLog] = useState(false);
  const [showRawSummary, setShowRawSummary] = useState(false);

  // ✅ 新增：避免圖表容器尚未算出尺寸就 render，導致 width/height = -1
  const [showCharts, setShowCharts] = useState(false);

  // 目前顯示的圖種（forecast/backtest）
  const [figTab, setFigTab] = useState("forecast");

  // ✅ 新增：讓同一次 run 的所有圖片都用同一個 cache bust key
  const [runNonce, setRunNonce] = useState(Date.now());

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
        console.log("[DBG] summary top keys:", Object.keys(j).slice(0, 30));
        console.log("[DBG] has figures_map:", !!j?.figures_map, "has figures_by_type:", !!j?.figures_by_type);
      })
      .catch((err) => {
        console.error("[DBG] fetch error:", err);
      });
  }, []);

  // ✅ 統一特徵重要性資料來源（支援新舊 schema）
  const featureItems = useMemo(() => {
    // 舊版：summary.features.main_top20
    if (
      Array.isArray(summary?.features?.main_top20) &&
      summary.features.main_top20.length > 0
    ) {
      return summary.features.main_top20;
    }

    // 新版：summary.features_block.items
    if (
      Array.isArray(summary?.features_block?.items) &&
      summary.features_block.items.length > 0
    ) {
      return summary.features_block.items;
    }

    // 新版：summary.features (array)
    if (Array.isArray(summary?.features) && summary.features.length > 0) {
      return summary.features;
    }

    return [];
  }, [summary]);

  useEffect(() => {
    const hasFeatures = Array.isArray(featureItems) && featureItems.length > 0;

    if (!hasFeatures) {
      setShowCharts(false);
      return;
    }

    const t = setTimeout(() => setShowCharts(true), 0);
    return () => clearTimeout(t);
  }, [featureItems]);

  // ✅ 把後端給的 path/filename 統一轉成可用 URL
  const toArtifactUrl = (p) => {
    if (!p) return null;
    const s = String(p);

    // 已經是完整 URL
    if (s.startsWith("http://") || s.startsWith("https://")) {
      return `${s}${s.includes("?") ? "&" : "?"}t=${runNonce}`;
    }

    // 可能是 artifacts/xxx.png 或 /artifacts/xxx.png 或純檔名 xxx.png
    let name = s;
    if (name.includes("/")) name = name.split("/").pop();
    return `${API}/artifacts/${name}?t=${runNonce}`;
  };

  const run = async () => {
    setLoading(true);
    setImgs([]);
    setSummary(null);
    setLog([]);
    setShowCharts(false);

    // ✅ 這次 run 的 cache bust key 固定住
    const nonce = Date.now();
    setRunNonce(nonce);

    try {
      // ① 呼叫後端 /run
      const res = await fetch(`${API}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fast_mode: fastMode }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[/run] HTTP error:", res.status, text);
        window.alert(`後端執行失敗（HTTP ${res.status}）。請看 Console / Log。`);
        return;
      }

      const data = await res.json();

      // ② 先把 /run 回傳的 artifacts 存著（當 fallback）
      const urls = (data.artifacts || [])
        .filter((n) => typeof n === "string" && n.endsWith(".png"))
        .map((n) => `${API}/artifacts/${n}?t=${nonce}`);
      setImgs(urls);

      // ③ 先用 /run 回傳的 summary 當 base
      let mergedSummary = data.summary || null;

      // ④ 再讀 artifacts/summary.json（檔案內容優先）
      try {
        const s = await fetch(`${API}/artifacts/summary.json?t=${nonce}`, {
          cache: "no-store",
        });
        if (s.ok) {
          const fresh = await s.json();

          // [FIX] features 可能是 Array，不能用 {...} merge 成 object
          const baseFeatures = (data.summary && data.summary.features) ?? undefined;
          const freshFeatures = (fresh && fresh.features) ?? undefined;

          const mergedFeatures =
            Array.isArray(freshFeatures)
              ? freshFeatures
              : Array.isArray(baseFeatures)
              ? baseFeatures
              : typeof freshFeatures === "object" && freshFeatures
              ? {
                  ...(typeof baseFeatures === "object" && baseFeatures ? baseFeatures : {}),
                  ...freshFeatures,
                }
              : typeof baseFeatures === "object" && baseFeatures
              ? baseFeatures
              : undefined;

          mergedSummary = {
            ...(data.summary || {}),
            ...fresh,
            ...(mergedFeatures !== undefined ? { features: mergedFeatures } : {}),
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

      if (mergedSummary) setSummary(mergedSummary);

      // ⑤ Log
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

    const rmse1 =
      s?.single_anchor?.rmse_1M ??
      s?.single_anchor_eval?.rmse_1m ??
      s?.metrics?.rmse_1m;

    const rmse3 =
      s?.single_anchor?.rmse_3M ??
      s?.single_anchor_eval?.rmse_3m ??
      s?.metrics?.rmse_3m;

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

  // ✅✅✅ 方案 A：圖的來源改成 summary.figures_map（不再猜檔名）
  const figureMap = useMemo(() => {
    const s = summary || {};
    const m =
      s?.figures_map ||
      s?.figures_by_type ||
      null;

    const pickLast = (arr) => {
      if (!Array.isArray(arr) || arr.length === 0) return null;
      return arr[arr.length - 1];
    };

    // 1) 優先使用後端提供的分類
    if (m && typeof m === "object") {
      const forecast = toArtifactUrl(pickLast(m.forecast));
      const backtest = toArtifactUrl(pickLast(m.backtest));
      return { forecast, backtest };
    }

    // 2) fallback：沿用你原本 imgs 的作法（避免沒上後端就整頁空白）
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

    const figureOnly = items.filter((it) => {
      const n = it.name.toLowerCase();
      return n.includes("figure") && !n.includes("feature_importance");
    });

    const getIdx = (name) => {
      const m = String(name).match(/_(\d{2})_/);
      return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
    };

    let forecast = null;
    let backtest = null;

    if (figureOnly.length >= 2) {
      const sorted = [...figureOnly].sort((a, b) => getIdx(a.name) - getIdx(b.name));
      backtest = sorted[0]?.url || null;
      forecast = sorted[sorted.length - 1]?.url || null;
    } else if (figureOnly.length === 1) {
      backtest = figureOnly[0].url;
      forecast = figureOnly[0].url;
    } else {
      if (items[1]) forecast = items[1].url;
      if (items[0]) backtest = items[0].url;
    }

    return { forecast, backtest };
  }, [summary, imgs, runNonce]);

  useEffect(() => {
    if (figureMap.forecast) setFigTab("forecast");
    else if (figureMap.backtest) setFigTab("backtest");
  }, [figureMap.forecast, figureMap.backtest]);

  const currentImg = figTab === "forecast" ? figureMap.forecast : figureMap.backtest;

  return (
    <div className="page">
      <header className="header">
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

        <div className="mode">
          <span className={`badge ${fastMode ? "on" : "off"}`}>
            {fastMode ? "FAST MODE" : "FULL MODE"}
          </span>
        </div>
      </header>

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
        <button
          className={`tab ${activeTab === "mode" ? "active" : ""}`}
          onClick={() => setActiveTab("mode")}
        >
          模式說明
        </button>
      </div>

      {activeTab === "dashboard" && (
        <>
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
              <a className="bigImg card" href={currentImg} target="_blank" rel="noreferrer">
                <img src={currentImg} alt={`figure-${figTab}`} />
              </a>
            )}
          </section>

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

                {Array.isArray(summary?.monthly_extrema) && summary.monthly_extrema.length > 0 && (
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

          <section>
            <h2>未來三個月每日預測價格</h2>

            {!summary || !Array.isArray(summary.future_3m_daily) || summary.future_3m_daily.length === 0 ? (
              <div className="empty card">
                <p>尚未有每日預測資料。</p>
              </div>
            ) : (
              <div className="card tableCard">
                <div className="tableHead" style={{ gridTemplateColumns: "1.5fr 1.5fr" }}>
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

          <section>
            <h2>特徵值與重要性</h2>

            {!summary || !Array.isArray(featureItems) || featureItems.length === 0 ? (
              <div className="empty card">
                <p>尚未執行預測，暫無特徵重要性資料。</p>
              </div>
            ) : (
              <div className="card" style={{ padding: 16, minHeight: 360, overflow: "visible" }}>
                {showCharts ? <FeatureImportanceChart data={featureItems} /> : <div style={{ opacity: 0.7 }}>圖表載入中…</div>}
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
