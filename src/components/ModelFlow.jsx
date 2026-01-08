// frontend/src/components/ModelFlow.jsx
import React from "react";

export default function ModelFlow() {
  return (
    <div className="modeExplainWrapper">
      <h2>模型預測流程說明</h2>
      <ol>
        <li>取得最新股價資料（FinMind + yfinance 合併）。</li>
        <li>進行資料清理（補缺值、移除異常值、時間排序）。</li>
        <li>計算技術指標（MA、RSI、MACD 等）當作模型特徵。</li>
        <li>切成訓練區、驗證區、測試區，維持時間順序。</li>
        <li>用 XGBoost 訓練「短期（1M）」與「中期（3M）」兩個模型。</li>
        <li>用 RMSE、趨勢方向等指標檢查模型表現。</li>
        <li>用最近一段時間的資料，讓模型預測未來 1–3 個月價格。</li>
        <li>加入偏移校正與波動調整，避免系統性低估或高估。</li>
        <li>依照預測結果與相對高低點規則，產生買進 / 賣出 / 觀望訊號。</li>
        <li>把預測曲線、區間帶與交易訊號畫成圖，顯示在前端畫面。</li>
      </ol>
      <p>
        這個頁面只是用文字幫你快速回顧：從「抓資料 → 做特徵 →
        訓練模型 → 校正 → 產生交易訊號 → 畫在圖上」的完整流程。
      </p>
    </div>
  );
}
