import streamlit as st  # type: ignore
import pandas as pd  # type: ignore
import matplotlib.pyplot as plt  # type: ignore
import time
from pathlib import Path
import sys
import os

# Add the project root to the path to allow importing from src
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from src.agents.sentiment_fetcher import get_sentiment_scores

# Paths
TRADE_LOG_DIR = Path("logs/trades")
TREND_MATCH_LOG_PATH = Path("logs/trend_match_log.csv")
SENTIMENT_LOG_PATH = Path("logs/sentiment_log.csv")

# Example static accuracy (replace later with real-time logic)
asset_accuracy = {
    "btcusdt": {"correct_predictions": 50, "total_predictions": 60},
    "ethusdt": {"correct_predictions": 45, "total_predictions": 60},
}

# UI Setup
st.set_page_config(page_title="📈 PortAI Dashboard", layout="wide")
st.title("📊 PortAI Realtime Trading Dashboard")
placeholder = st.empty()

while True:
    with placeholder.container():
        # 📡 Sentiment Scores Section
        st.subheader("🔮 Real-Time Sentiment Scores")
        sentiment = get_sentiment_scores()
        col1, col2, col3, col4 = st.columns(4)
        col1.metric("📰 News", f"{sentiment['news']:.3f}")
        col2.metric("🐦 Twitter", f"{sentiment['twitter']:.3f}")
        col3.metric("📱 Reddit", f"{sentiment['reddit']:.3f}")
        col4.metric("📊 Final Score", f"{sentiment['final_score']:.3f}")

        # 📊 Historical Sentiment Trend Section
        st.subheader("📈 Historical Sentiment Trend")
        if SENTIMENT_LOG_PATH.exists():
            df_sentiment = pd.read_csv(SENTIMENT_LOG_PATH)
            df_sentiment["timestamp"] = pd.to_datetime(df_sentiment["timestamp"])
            df_sentiment = df_sentiment.sort_values("timestamp")
            
            fig, ax = plt.subplots()
            ax.plot(df_sentiment["timestamp"], df_sentiment["news"], label="📰 News", linestyle="--", marker="o")
            ax.plot(df_sentiment["timestamp"], df_sentiment["twitter"], label="🐦 Twitter", linestyle="--", marker="x")
            ax.plot(df_sentiment["timestamp"], df_sentiment["reddit"], label="📱 Reddit", linestyle="--", marker="^")
            ax.plot(df_sentiment["timestamp"], df_sentiment["final_score"], label="📊 Final Score", linewidth=2.5)
            
            ax.set_title("Sentiment Sources Over Time")
            ax.set_ylabel("Sentiment Score (-1 to +1)")
            ax.set_xlabel("Timestamp")
            ax.grid(True)
            ax.legend()
            st.pyplot(fig)
        else:
            st.warning("No sentiment log data available yet.")

        st.subheader("🧾 Latest Trades (Live)")

        trade_files = list(TRADE_LOG_DIR.glob("*.csv"))
        if not trade_files:
            st.warning("🚫 No live trade logs found in 'trades/' folder.")
        else:
            latest_log = max(trade_files, key=lambda x: x.stat().st_mtime)
            df = pd.read_csv(latest_log)

            # Clean and standardize
            df.columns = [col.strip().lower() for col in df.columns]
            df["timestamp"] = pd.to_datetime(df["timestamp"])
            df = df.sort_values("timestamp")

            st.dataframe(df.tail(20), use_container_width=True)

            st.subheader("📉 PnL Trend")
            if "pnl" in df.columns:
                df["PnL_cumsum"] = df["pnl"].cumsum()
                st.line_chart(df.set_index("timestamp")["PnL_cumsum"])
            else:
                st.warning("⚠️ 'pnl' column not found in latest trade log.")

            st.subheader("📌 Trade Summary")
            total_trades = len(df)
            col1, col2, col3 = st.columns(3)
            col1.metric("Total Trades", total_trades)

            if "pnl" in df.columns:
                total_pnl = round(df["pnl"].sum(), 2)
                win_trades = (df["pnl"] > 0).sum()
                win_rate = round((win_trades / total_trades) * 100, 2) if total_trades else 0.0
                col2.metric("Total PnL", f"${total_pnl}")
                col3.metric("Win Rate", f"{win_rate}%")
            else:
                col2.metric("Total PnL", "N/A")
                col3.metric("Win Rate", "N/A%")

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
            st.warning("📉 trend_match_log.csv not found.")

        st.subheader("🎯 Asset-wise Model Accuracy")
        for symbol, acc_data in asset_accuracy.items():
            pct = (acc_data["correct_predictions"] / acc_data["total_predictions"]) * 100
            st.metric(
                label=f"{symbol.upper()} Accuracy",
                value=f"{pct:.2f}%",
                delta=f"{acc_data['correct_predictions']}/{acc_data['total_predictions']}"
            )

    time.sleep(5)