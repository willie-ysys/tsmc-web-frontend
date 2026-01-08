// frontend/src/components/ModeExplain.jsx
import React from "react";

export default function ModeExplain() {
  return (
    // 跟 ModelFlow 一樣，在卡片裡再加一層內縮 padding
    <div style={{ padding: "16px 40px 24px", lineHeight: 1.6 }}>
      <h2 style={{ marginTop: 0 }}>FAST MODE 與 FULL MODE 模式說明</h2>

      <p>
        這個頁面簡單說明「急速模式（FAST_MODE）」和「完整模式」的差別，
        幫助你決定在什麼情境要用哪一種。
      </p>

      <ol>
        <li>
          <b>急速模式（FAST_MODE）：追求速度</b>
          <ul>
            <li>跳過較耗時的超參數搜尋，只使用事先決定好的 XGBoost 參數。</li>
            <li>訓練與預測流程較精簡，重點是「快速產出新預測結果」。</li>
            <li>適合平常想快速看最新走勢、常常按「執行預測」的情境。</li>
          </ul>
        </li>

        <li>
          <b>完整模式（關閉 FAST_MODE）：追求穩定與精細</b>
          <ul>
            <li>會開啟較完整的訓練流程，例如調整模型超參數與做更多檢查。</li>
            <li>計算時間比急速模式長，但有機會讓模型在近期資料上更貼近。</li>
            <li>適合要做報告、重訓模型或想仔細評估模型表現時使用。</li>
          </ul>
        </li>

        <li>
          <b>如何選擇？</b>
          <ul>
            <li>平常看盤、想快快看結果 → 建議開「急速模式」（預設勾選）。</li>
            <li>要重新整理模型、做較正式的分析 → 建議關掉 FAST_MODE，用完整模式。</li>
          </ul>
        </li>
      </ol>
    </div>
  );
}
