import streamlit as st  # type: ignore
import pandas as pd  # type: ignore
import time
from pathlib import Path
import matplotlib.pyplot as plt  # type: ignore

# Paths
TRADE_LOG_PATH = Path("logs/trade_log.csv")
TREND_MATCH_LOG_PATH = Path("logs/trend_match_log.csv")

# Asset Accuracy Data (Example format, replace with actual data from your system)
# You will need to dynamically update this dictionary in your system
asset_accuracy = {
    "btcusdt": {"correct_predictions": 50, "total_predictions": 60},
    "ethusdt": {"correct_predictions": 45, "total_predictions": 60},
}

# UI Setup
st.set_page_config(page_title="📊 PortAI Realtime Cockpit", layout="wide")
st.title("📊 PortAI Realtime Trading Dashboard")

placeholder = st.empty()

while True:
    with placeholder.container():
        st.subheader("💹 Trade Log")

        if TRADE_LOG_PATH.exists():
            df = pd.read_csv(TRADE_LOG_PATH)
            df.columns = [col.strip() for col in df.columns]
            df["timestamp"] = pd.to_datetime(df["timestamp"])

            st.dataframe(df.tail(10), use_container_width=True)

            # Profit/Loss Trend
            st.subheader("📈 Profit/Loss Trend")
            df["PnL_cumsum"] = df["pnl"].cumsum()
            st.line_chart(df.set_index("timestamp")["PnL_cumsum"])

            # Metrics Summary
            st.subheader("🧮 Metrics Summary")
            total_trades = len(df)
            total_pnl = round(df["pnl"].sum(), 2)
            win_trades = (df["pnl"] > 0).sum()
            win_rate = round((win_trades / total_trades) * 100, 2) if total_trades > 0 else 0.0

            col1, col2, col3 = st.columns(3)
            col1.metric("Total Trades", total_trades)
            col2.metric("Total PnL", f"${total_pnl}")
            col3.metric("Win Rate", f"{win_rate}%")
        else:
            st.warning("🚫 No trade_log.csv found.")

        # Sprint 6.4: Trend Match Plot
        st.subheader("📊 ML Prediction vs Actual Trend")

        if TREND_MATCH_LOG_PATH.exists():
            trend_df = pd.read_csv(TREND_MATCH_LOG_PATH)
            trend_df["timestamp"] = pd.to_datetime(trend_df["timestamp"])

            fig, ax = plt.subplots()
            ax.plot(trend_df["timestamp"], trend_df["actual"], label="Actual", linestyle="--", marker="o")
            ax.plot(trend_df["timestamp"], trend_df["predicted"], label="Predicted", linestyle="-", marker="x")
            ax.set_title("📉 Trend Match: Predicted vs Actual")
            ax.set_ylabel("Trend: 1 (Bullish), 0 (Neutral), -1 (Bearish)")
            ax.legend()
            ax.grid(True)
            st.pyplot(fig)
        else:
            st.warning("📉 trend_match_log.csv not found yet.")

        # Step 3: Display Per-Asset Accuracy in the dashboard
        st.subheader("🔍 Per-Asset Accuracy")
        for symbol, accuracy_data in asset_accuracy.items():
            accuracy_percentage = (accuracy_data["correct_predictions"] / accuracy_data["total_predictions"]) * 100
            st.write(f"**{symbol.upper()}**: {accuracy_percentage:.2f}% Accuracy")

    time.sleep(5)