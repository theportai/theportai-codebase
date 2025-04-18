import streamlit as st
import pandas as pd # type: ignore
import matplotlib.pyplot as plt # type: ignore
import time
from pathlib import Path
import sys
import os
import numpy as np # type: ignore
from datetime import datetime, timedelta
import matplotlib.dates as mdates # type: ignore

# Configure matplotlib for better visuals
plt.style.use('dark_background')

# Add the project root to the path to allow importing from src
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
from src.utils.audit_logger import log_event
from src.agents.sentiment_fetcher import get_sentiment_scores
from src.core.token_manager import TokenManager

# Initialize TokenManager
tm = TokenManager()
live_mode = False

# Paths
TRADE_LOG_DIR = Path("logs/trades")
TREND_MATCH_LOG_PATH = Path("logs/trend_match_log.csv")
SENTIMENT_LOG_PATH = Path("logs/sentiment_log.csv")

# Example static accuracy (replace later with real-time logic)
asset_accuracy = {
    "btcusdt": {"correct_predictions": 50, "total_predictions": 60},
    "ethusdt": {"correct_predictions": 45, "total_predictions": 60},
}

# Custom color palette
COLORS = {
    "primary": "#3a86ff",
    "success": "#38b000",
    "danger": "#d90429",
    "warning": "#ffbe0b",
    "info": "#8338ec",
    "bg": "#0f1020",
    "card": "#1a1b2e",
    "news": "#8ecae6",
    "twitter": "#219ebc",
    "reddit": "#023047",
    "final": "#ffb703"
}

# UI Setup with custom theme
st.set_page_config(
    page_title="📈 PortAI Dashboard",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for a sleek, modern look
st.markdown("""
<style>
    /* Main background */
    .stApp {
        background-color: #0f1020;
    }

    /* Headers */
    h1, h2, h3, h4 {
        color: white !important;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    }

    /* Metric cards */
    div[data-testid="stMetricValue"] {
        font-size: 2.5rem !important;
        font-weight: bold !important;
    }

    div[data-testid="stMetricLabel"] {
        font-size: 1.2rem !important;
    }

    div[data-testid="stMetricDelta"] {
        font-size: 1rem !important;
    }

    /* Card-like containers */
    div.stBlock {
        border-radius: 10px;
        padding: 1rem;
        background-color: #1a1b2e;
        border: 1px solid #2f3156;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    /* Tables */
    .dataframe {
        font-family: 'Segoe UI', sans-serif !important;
    }

    /* Buttons */
    button[kind="secondary"] {
        background-color: #3a86ff !important;
        color: white !important;
    }

    /* Sidebar */
    section[data-testid="stSidebar"] {
        background-color: #171727;
        border-right: 1px solid #2f3156;
    }

    /* Alert boxes */
    div[data-testid="stAlert"] {
        border-radius: 8px;
    }
</style>
""", unsafe_allow_html=True)

# Live mode banner
if live_mode:
    st.markdown(
        """
        <div style="background-color:#300; padding:15px; border-radius:8px; border: 2px solid #d90429; margin-bottom: 20px;">
            <h3 style="color:#d90429; margin:0; display:flex; align-items:center;">
                <span style="font-size:24px; margin-right:10px;">🚨</span> LIVE MODE ENABLED — Real trades are being executed on Binance Mainnet!
            </h3>
        </div>
        """, unsafe_allow_html=True
    )

# Session state for user authentication
if "authenticated" not in st.session_state:
    st.session_state.authenticated = False

# Add logout option in sidebar (outside the main loop to prevent duplicate widget ID errors)
if st.session_state.authenticated:
    st.sidebar.title("PortAI Navigation")
    st.sidebar.markdown("---")
    st.sidebar.markdown("### 📊 Dashboard Settings")
    refresh_rate = st.sidebar.slider("Refresh Rate (sec)", 1, 30, 5)

    st.sidebar.markdown("---")
    st.sidebar.markdown("### 👤 User Controls")
    if st.sidebar.button("🔒 Logout", key="logout_button", use_container_width=True):
        st.session_state.authenticated = False
        st.rerun()

    st.sidebar.markdown("---")
    st.sidebar.info("PortAI Trading System v2.1\nLast Updated: April 2025")

# ====== AUTHENTICATION SECTION ======
if not st.session_state.authenticated:
    col1, col2, col3 = st.columns([1, 2, 1])

    with col2:
        st.markdown("""
        <div style="text-align:center; padding:20px; margin-top:50px;">
            <h1 style="font-size:3rem;">🔐 PortAI Dashboard</h1>
            <p style="font-size:1.2rem; margin-bottom:30px;">Enter your authentication token to access the trading dashboard</p>
        </div>
        """, unsafe_allow_html=True)

        with st.container():
            st.markdown('<div style="background-color:#1a1b2e; padding:30px; border-radius:10px; border:1px solid #2f3156;">', unsafe_allow_html=True)

            # Prompt for token input
            token_input = st.text_input("Enter your temporary access token:", type="password")

            st.markdown('<div style="display:flex; justify-content:center; margin-top:20px;">', unsafe_allow_html=True)
            if st.button("Verify Token", key="verify_token_button", use_container_width=True):
                if tm.validate_token(token_input, agent_name="sentiment_agent"):
                    st.session_state.authenticated = True
                    log_event("dashboard_login", "Streamlit dashboard accessed", agent="sentiment_agent")
                    st.success("✅ Access granted. Welcome to the dashboard!")
                    st.rerun()
                else:
                    st.error("❌ Invalid or expired token. Access denied.")
            st.markdown('</div>', unsafe_allow_html=True)
            st.markdown('</div>', unsafe_allow_html=True)

    st.stop()  # Prevent loading rest of dashboard until authenticated

# ====== DASHBOARD SECTION (Only shown when authenticated) ======
st.title("📊 PortAI Realtime Trading Dashboard")

# Dashboard header with status and time
header_col1, header_col2 = st.columns([3, 1])
with header_col1:
    if live_mode:
        st.markdown("""
        <div style="display:flex; align-items:center;">
            <div style="background-color:#d90429; width:12px; height:12px; border-radius:50%; margin-right:8px;"></div>
            <span style="color:#d90429; font-weight:bold; font-size:1.2rem;">LIVE MODE ENABLED — Real trades are being executed</span>
        </div>
        """, unsafe_allow_html=True)
    else:
        st.markdown("""
        <div style="display:flex; align-items:center;">
            <div style="background-color:#38b000; width:12px; height:12px; border-radius:50%; margin-right:8px;"></div>
            <span style="color:#38b000; font-weight:bold; font-size:1.2rem;">SIMULATION MODE — No real trades are being executed</span>
        </div>
        """, unsafe_allow_html=True)

with header_col2:
    st.markdown(f"""
    <div style="text-align:right; font-size:0.9rem; color:#888;">
        Last updated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
    </div>
    """, unsafe_allow_html=True)

st.markdown("---")

placeholder = st.empty()

# Counter to ensure unique keys for each update cycle
if "update_counter" not in st.session_state:
    st.session_state.update_counter = 0

# Define PnL highlighting function (fixed version)
def highlight_pnl(df):
    # Create a copy to avoid modifying the original
    styled = pd.DataFrame('', index=df.index, columns=df.columns)

    # Only apply the styling to PnL columns
    for col in df.columns:
        if 'pnl' in str(col).lower():
            # Apply styling based on value
            for i in df.index:
                try:
                    val = df.loc[i, col]
                    if isinstance(val, (int, float)) or (isinstance(val, str) and val.replace('.', '', 1).replace('-', '', 1).isdigit()):
                        float_val = float(val)
                        if float_val > 0:
                            styled.loc[i, col] = 'background-color: rgba(56, 176, 0, 0.2); color: #38b000;'
                        elif float_val < 0:
                            styled.loc[i, col] = 'background-color: rgba(217, 4, 41, 0.2); color: #d90429;'
                except (ValueError, TypeError):
                    pass
    return styled

while True:
    # Increment counter to create unique keys
    st.session_state.update_counter += 1
    counter = st.session_state.update_counter

    with placeholder.container():
        # 📡 Sentiment Scores Section
        sentiment_col, trend_col = st.columns([1, 1])

        with sentiment_col:
            st.markdown("""
            <h3 style="display:flex; align-items:center; margin-bottom:20px;">
                <span style="font-size:24px; margin-right:10px;">🔮</span> Real-Time Sentiment Scores
            </h3>
            """, unsafe_allow_html=True)

            try:
                sentiment = get_sentiment_scores()
                col1, col2, col3, col4 = st.columns(4)

                col1.markdown('<div style="background-color:#1a1b2e; padding:15px; border-radius:10px; border:1px solid #2f3156;">', unsafe_allow_html=True)
                col1.metric("📰 News", f"{sentiment['news']:.3f}",
                            delta=f"{sentiment['news']-0.5:.3f}" if sentiment['news'] != 0.5 else None,
                            delta_color="normal")
                col1.markdown('</div>', unsafe_allow_html=True)

                col2.markdown('<div style="background-color:#1a1b2e; padding:15px; border-radius:10px; border:1px solid #2f3156;">', unsafe_allow_html=True)
                col2.metric("🐦 Twitter", f"{sentiment['twitter']:.3f}",
                            delta=f"{sentiment['twitter']-0.5:.3f}" if sentiment['twitter'] != 0.5 else None,
                            delta_color="normal")
                col2.markdown('</div>', unsafe_allow_html=True)

                col3.markdown('<div style="background-color:#1a1b2e; padding:15px; border-radius:10px; border:1px solid #2f3156;">', unsafe_allow_html=True)
                col3.metric("📱 Reddit", f"{sentiment['reddit']:.3f}",
                            delta=f"{sentiment['reddit']-0.5:.3f}" if sentiment['reddit'] != 0.5 else None,
                            delta_color="normal")
                col3.markdown('</div>', unsafe_allow_html=True)

                col4.markdown('<div style="background-color:#1a1b2e; padding:15px; border-radius:10px; border:1px solid #2f3156; border-left:4px solid #ffb703;">', unsafe_allow_html=True)
                col4.metric("📊 Final Score", f"{sentiment['final_score']:.3f}",
                            delta=f"{sentiment['final_score']-0.5:.3f}" if sentiment['final_score'] != 0.5 else None,
                            delta_color="normal")
                col4.markdown('</div>', unsafe_allow_html=True)
            except Exception as e:
                st.error(f"Error loading sentiment data: {str(e)}")

        with trend_col:
            st.markdown("""
            <h3 style="display:flex; align-items:center; margin-bottom:20px;">
                <span style="font-size:24px; margin-right:10px;">🎯</span> Model Accuracy Metrics
            </h3>
            """, unsafe_allow_html=True)

            # Create a gauge-like visualization for each asset
            for symbol, acc_data in asset_accuracy.items():
                pct = (acc_data["correct_predictions"] / acc_data["total_predictions"]) * 100

                # Create progress bar styling based on accuracy
                color = "#d90429" if pct < 50 else "#ffbe0b" if pct < 70 else "#38b000"

                st.markdown(f"""
                <div style="background-color:#1a1b2e; padding:15px; border-radius:10px; border:1px solid #2f3156; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px;">
                        <span style="font-size:1.1rem; font-weight:bold;">{symbol.upper()} Accuracy</span>
                        <span style="font-weight:bold; font-size:1.1rem;">{pct:.1f}%</span>
                    </div>
                    <div style="background-color:#0f1020; height:10px; border-radius:5px; overflow:hidden;">
                        <div style="width:{pct}%; background-color:{color}; height:100%;"></div>
                    </div>
                    <div style="text-align:right; font-size:0.8rem; margin-top:5px; color:#aaa;">
                        {acc_data['correct_predictions']}/{acc_data['total_predictions']} correct predictions
                    </div>
                </div>
                """, unsafe_allow_html=True)

        # 📊 Historical Sentiment Trend Section
        st.markdown("""
        <h3 style="display:flex; align-items:center; margin-top:30px; margin-bottom:20px;">
            <span style="font-size:24px; margin-right:10px;">📈</span> Historical Sentiment Trend
        </h3>
        """, unsafe_allow_html=True)

        if SENTIMENT_LOG_PATH.exists():
            try:
                df_sentiment = pd.read_csv(SENTIMENT_LOG_PATH)
                df_sentiment["timestamp"] = pd.to_datetime(df_sentiment["timestamp"])
                df_sentiment = df_sentiment.sort_values("timestamp")

                if len(df_sentiment) > 0:
                    fig, ax = plt.subplots(figsize=(12, 6), facecolor='#0f1020')
                    ax.plot(df_sentiment["timestamp"], df_sentiment["news"], label="📰 News",
                            linestyle="--", marker="o", color=COLORS["news"], linewidth=2, markersize=5)
                    ax.plot(df_sentiment["timestamp"], df_sentiment["twitter"], label="🐦 Twitter",
                            linestyle="--", marker="x", color=COLORS["twitter"], linewidth=2, markersize=5)
                    ax.plot(df_sentiment["timestamp"], df_sentiment["reddit"], label="📱 Reddit",
                            linestyle="--", marker="^", color=COLORS["reddit"], linewidth=2, markersize=5)
                    ax.plot(df_sentiment["timestamp"], df_sentiment["final_score"], label="📊 Final Score",
                            linewidth=3, color=COLORS["final"])

                    # Add horizontal line at 0
                    ax.axhline(y=0, color='#444', linestyle='-', alpha=0.3)

                    # Add a light grid
                    ax.grid(True, alpha=0.2, linestyle='--')

                    # Style customization
                    ax.set_facecolor('#0f1020')
                    ax.spines['top'].set_visible(False)
                    ax.spines['right'].set_visible(False)
                    ax.spines['bottom'].set_color('#333')
                    ax.spines['left'].set_color('#333')

                    ax.set_title("Sentiment Sources Over Time", fontsize=16, pad=20, color='white')
                    ax.set_ylabel("Sentiment Score (-1 to +1)", fontsize=12, color='white')
                    ax.set_xlabel("Timestamp", fontsize=12, color='white')

                    # Format x-axis dates nicely
                    ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d %H:%M'))
                    plt.xticks(rotation=45)

                    # Improve legend
                    leg = ax.legend(facecolor='#1a1b2e', framealpha=0.9, edgecolor='#333')
                    for text in leg.get_texts():
                        text.set_color('white')

                    fig.tight_layout()
                    st.pyplot(fig)
                else:
                    st.info("Sentiment log file exists but contains no data.")
            except Exception as e:
                st.error(f"Error processing sentiment log: {str(e)}")
        else:
            st.markdown("""
            <div style="background-color:#1a1b2e; padding:20px; border-radius:10px; border:1px solid #2f3156; text-align:center;">
                <div style="font-size:24px; margin-bottom:10px;">📊</div>
                <div style="font-weight:bold; margin-bottom:5px;">No sentiment data available yet</div>
                <div style="color:#888; font-size:0.9rem;">Waiting for sentiment analysis to begin logging data</div>
            </div>
            """, unsafe_allow_html=True)

        # Trade Activity Section
        st.markdown("""
        <h3 style="display:flex; align-items:center; margin-top:30px; margin-bottom:20px;">
            <span style="font-size:24px; margin-right:10px;">🧾</span> Latest Trades (Live)
        </h3>
        """, unsafe_allow_html=True)

        trade_files = list(TRADE_LOG_DIR.glob("*.csv"))
        if not trade_files:
            st.markdown("""
            <div style="background-color:#1a1b2e; padding:20px; border-radius:10px; border:1px solid #2f3156; text-align:center;">
                <div style="font-size:24px; margin-bottom:10px;">🚫</div>
                <div style="font-weight:bold; margin-bottom:5px;">No trade logs found</div>
                <div style="color:#888; font-size:0.9rem;">Waiting for trading activity to begin in 'logs/trades/' folder</div>
            </div>
            """, unsafe_allow_html=True)
        else:
            try:
                latest_log = max(trade_files, key=lambda x: x.stat().st_mtime)
                df = pd.read_csv(latest_log)

                # Clean and standardize column names
                df.columns = [col.strip().lower() for col in df.columns]

                # Ensure timestamp column exists and convert to datetime
                if "timestamp" in df.columns:
                    df["timestamp"] = pd.to_datetime(df["timestamp"], errors='coerce')
                    df = df.sort_values("timestamp", ascending=False)

                # Display enhanced table with proper styling
                st.dataframe(
                    df.head(20).style.apply(highlight_pnl, axis=None),
                    use_container_width=True,
                    height=400
                )

                # PnL and Summary Sections side by side
                pnl_col, summary_col = st.columns([2, 1])

                with pnl_col:
                    st.markdown("""
                    <h3 style="display:flex; align-items:center; margin-top:20px; margin-bottom:20px;">
                        <span style="font-size:24px; margin-right:10px;">📉</span> PnL Trend
                    </h3>
                    """, unsafe_allow_html=True)

                    if "pnl" in df.columns:
                        # Convert PnL to numeric, handling any non-numeric values
                        df["pnl"] = pd.to_numeric(df["pnl"], errors='coerce')

                        # Calculate cumulative PnL
                        df = df.sort_values("timestamp")  # Sort by time for cumulative calculation
                        df["PnL_cumsum"] = df["pnl"].cumsum()

                        # Enhanced PnL visualization
                        fig, ax = plt.subplots(figsize=(10, 5), facecolor='#0f1020')

                        # Create a time series for plotting
                        cumsum_series = df.set_index("timestamp")["PnL_cumsum"].dropna()

                        if not cumsum_series.empty:
                            # Line for cumulative PnL
                            ax.plot(cumsum_series.index, cumsum_series.values, color=COLORS["primary"], linewidth=2.5)

                            # Fill area under curve - green if positive, red if negative
                            ax.fill_between(
                                cumsum_series.index,
                                0,
                                cumsum_series.values,
                                where=(cumsum_series.values > 0),
                                color=COLORS["success"],
                                alpha=0.3
                            )
                            ax.fill_between(
                                cumsum_series.index,
                                0,
                                cumsum_series.values,
                                where=(cumsum_series.values <= 0),
                                color=COLORS["danger"],
                                alpha=0.3
                            )

                            # Add horizontal line at 0
                            ax.axhline(y=0, color='#444', linestyle='-', alpha=0.5)

                            # Add grid
                            ax.grid(True, alpha=0.1, linestyle='--')

                            # Style customization
                            ax.set_facecolor('#0f1020')
                            ax.spines['top'].set_visible(False)
                            ax.spines['right'].set_visible(False)
                            ax.spines['bottom'].set_color('#333')
                            ax.spines['left'].set_color('#333')

                            ax.set_title("Cumulative Profit/Loss Over Time", fontsize=14, color='white')
                            ax.set_ylabel("Cumulative PnL ($)", fontsize=12, color='white')
                            ax.tick_params(colors='white')

                            # Format x-axis dates
                            ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d %H:%M'))
                            plt.xticks(rotation=45)

                            fig.tight_layout()
                            st.pyplot(fig)
                        else:
                            st.warning("No valid PnL data points to visualize.")
                    else:
                        st.warning("⚠️ 'pnl' column not found in latest trade log.")

                with summary_col:
                    st.markdown("""
                    <h3 style="display:flex; align-items:center; margin-top:20px; margin-bottom:20px;">
                        <span style="font-size:24px; margin-right:10px;">📌</span> Trade Summary
                    </h3>
                    """, unsafe_allow_html=True)

                    total_trades = len(df)

                    if "pnl" in df.columns:
                        # Convert to numeric and handle NaN values
                        df["pnl"] = pd.to_numeric(df["pnl"], errors='coerce')
                        valid_pnl = df["pnl"].dropna()

                        if not valid_pnl.empty:
                            total_pnl = round(valid_pnl.sum(), 2)
                            win_trades = (valid_pnl > 0).sum()
                            loss_trades = (valid_pnl < 0).sum()
                            neutral_trades = (valid_pnl == 0).sum()
                            win_rate = round((win_trades / len(valid_pnl)) * 100, 2) if len(valid_pnl) > 0 else 0.0

                            # Calculate average gain/loss
                            avg_win = round(valid_pnl[valid_pnl > 0].mean(), 2) if win_trades > 0 else 0
                            avg_loss = round(valid_pnl[valid_pnl < 0].mean(), 2) if loss_trades > 0 else 0

                            st.markdown(f"""
                            <div style="background-color:#1a1b2e; padding:20px; border-radius:10px; border:1px solid #2f3156; margin-bottom:15px;">
                                <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                                    <span style="font-size:1rem; color:#aaa;">Total PnL</span>
                                    <span style="font-size:1.5rem; font-weight:bold; color:{'#38b000' if total_pnl > 0 else '#d90429' if total_pnl < 0 else '#aaa'};">{'$'+str(total_pnl)}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; margin-bottom:15px;">
                                    <span style="font-size:1rem; color:#aaa;">Win Rate</span>
                                    <span style="font-size:1.5rem; font-weight:bold;">{win_rate}%</span>
                                </div>
                                <div style="display:flex; justify-content:space-between;">
                                    <span style="font-size:1rem; color:#aaa;">Total Trades</span>
                                    <span style="font-size:1.5rem; font-weight:bold;">{total_trades}</span>
                                </div>
                            </div>

                            <div style="background-color:#1a1b2e; padding:20px; border-radius:10px; border:1px solid #2f3156;">
                                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                                    <span style="font-size:0.9rem; color:#aaa;">Win/Loss/Neutral</span>
                                    <span style="font-weight:bold;">{win_trades} / {loss_trades} / {neutral_trades}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                                    <span style="font-size:0.9rem; color:#aaa;">Avg Win</span>
                                    <span style="font-weight:bold; color:#38b000;">${avg_win}</span>
                                </div>
                                <div style="display:flex; justify-content:space-between;">
                                    <span style="font-size:0.9rem; color:#aaa;">Avg Loss</span>
                                    <span style="font-weight:bold; color:#d90429;">${avg_loss}</span>
                                </div>
                            </div>
                            """, unsafe_allow_html=True)
                        else:
                            st.warning("PnL column exists but contains no valid numeric data.")
                    else:
                        st.metric("Total Trades", total_trades)
                        st.markdown("""
                        <div style="background-color:#1a1b2e; padding:20px; border-radius:10px; border:1px solid #2f3156; text-align:center; margin-top:15px;">
                            <div style="color:#aaa;">PnL metrics not available</div>
                        </div>
                        """, unsafe_allow_html=True)
            except Exception as e:
                st.error(f"Error processing trade data: {str(e)}")

        # 📊 ML Prediction vs Actual Trend
        st.markdown("""
        <h3 style="display:flex; align-items:center; margin-top:30px; margin-bottom:20px;">
            <span style="font-size:24px; margin-right:10px;">📊</span> ML Prediction vs Actual Trend
        </h3>
        """, unsafe_allow_html=True)

        if TREND_MATCH_LOG_PATH.exists():
            try:
                trend_df = pd.read_csv(TREND_MATCH_LOG_PATH)
                trend_df["timestamp"] = pd.to_datetime(trend_df["timestamp"], errors='coerce')

                # Filter out rows with invalid timestamps
                trend_df = trend_df.dropna(subset=["timestamp"])

                if not trend_df.empty:
                    # Calculate prediction accuracy
                    trend_df["is_correct"] = trend_df["predicted"] == trend_df["actual"]
                    accuracy = (trend_df["is_correct"].sum() / len(trend_df)) * 100 if len(trend_df) > 0 else 0

                    # Add accuracy metric above chart
                    accuracy_col1, accuracy_col2 = st.columns([1, 3])
                    with accuracy_col1:
                        st.markdown(f"""
                        <div style="background-color:#1a1b2e; padding:20px; border-radius:10px; border:1px solid #2f3156; text-align:center;">
                            <div style="font-size:0.9rem; color:#aaa; margin-bottom:5px;">Overall Prediction Accuracy</div>
                            <div style="font-size:2rem; font-weight:bold; color:{'#38b000' if accuracy >= 70 else '#ffbe0b' if accuracy >= 50 else '#d90429'};">{accuracy:.1f}%</div>
                        </div>
                        """, unsafe_allow_html=True)

                    # Plot prediction matches over time
                    with accuracy_col2:
                        # Sort by timestamp to ensure chronological order
                        trend_df = trend_df.sort_values("timestamp")

                        fig, ax = plt.subplots(figsize=(10, 4), facecolor='#0f1020')

                        # Plot correct and incorrect predictions
                        correct_df = trend_df[trend_df["is_correct"]]
                        incorrect_df = trend_df[~trend_df["is_correct"]]

                        # Plot green points for correct predictions
                        if not correct_df.empty:
                            ax.scatter(correct_df["timestamp"], [1] * len(correct_df),
                                       color=COLORS["success"], marker="o", s=60, label="Correct")

                        # Plot red points for incorrect predictions
                        if not incorrect_df.empty:
                            ax.scatter(incorrect_df["timestamp"], [0] * len(incorrect_df),
                                       color=COLORS["danger"], marker="x", s=60, label="Incorrect")

                        # Style the plot
                        ax.set_yticks([0, 1])
                        ax.set_yticklabels(["Incorrect", "Correct"])
                        ax.set_ylim(-0.5, 1.5)

                        ax.grid(True, alpha=0.1, linestyle='--')
                        ax.set_facecolor('#0f1020')
                        ax.spines['top'].set_visible(False)
                        ax.spines['right'].set_visible(False)
                        ax.spines['bottom'].set_color('#333')
                        ax.spines['left'].set_color('#333')

                        # Format x-axis dates
                        ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d %H:%M'))
                        plt.xticks(rotation=45)

                        # Add legend
                        leg = ax.legend(loc="upper right", facecolor='#1a1b2e', framealpha=0.9, edgecolor='#333')
                        for text in leg.get_texts():
                            text.set_color('white')

                        fig.tight_layout()
                        st.pyplot(fig)

                    # Get the last few predictions with detailed information
                    st.markdown("""
                    <h4 style="margin-top:20px; margin-bottom:15px;">Recent Predictions</h4>
                    """, unsafe_allow_html=True)

                    # Display the last 10 predictions as a styled table
                    recent_preds = trend_df.sort_values("timestamp", ascending=False).head(10)

                    # Function to color status
                    def color_status(val):
                        if val:
                            return f'background-color: rgba(56, 176, 0, 0.2); color: #38b000;'
                        else:
                            return f'background-color: rgba(217, 4, 41, 0.2); color: #d90429;'

                    recent_styled = recent_preds.style\
                        .format({'timestamp': lambda x: x.strftime('%Y-%m-%d %H:%M:%S')})\
                        .applymap(lambda v: color_status(v) if isinstance(v, bool) else '')

                    st.dataframe(recent_styled, use_container_width=True)
                else:
                    st.info("No valid prediction data points found in the trend match log.")
            except Exception as e:
                st.error(f"Error processing trend match data: {str(e)}")
        else:
            st.markdown("""
            <div style="background-color:#1a1b2e; padding:20px; border-radius:10px; border:1px solid #2f3156; text-align:center;">
                <div style="font-size:24px; margin-bottom:10px;">📊</div>
                <div style="font-weight:bold; margin-bottom:5px;">No prediction data available yet</div>
                <div style="color:#888; font-size:0.9rem;">Waiting for ML predictions to begin logging data</div>
            </div>
            """, unsafe_allow_html=True)

        # System Logs Section
        st.markdown("""
        <h3 style="display:flex; align-items:center; margin-top:30px; margin-bottom:20px;">
            <span style="font-size:24px; margin-right:10px;">🔍</span> System Status
        </h3>
        """, unsafe_allow_html=True)

        # Generate some mock system metrics for demonstration
        system_col1, system_col2, system_col3 = st.columns(3)

        with system_col1:
            st.markdown('<div style="background-color:#1a1b2e; padding:15px; border-radius:10px; border:1px solid #2f3156;">', unsafe_allow_html=True)

            # Mock CPU usage (random value between 10-40%)
            cpu_usage = np.random.uniform(10, 40)
            st.metric("CPU Usage", f"{cpu_usage:.1f}%", delta=None)

            # Progress bar for CPU
            st.progress(cpu_usage/100)
            st.markdown('</div>', unsafe_allow_html=True)

        with system_col2:
            st.markdown('<div style="background-color:#1a1b2e; padding:15px; border-radius:10px; border:1px solid #2f3156;">', unsafe_allow_html=True)

            # Mock memory usage (random value between 30-70%)
            memory_usage = np.random.uniform(30, 70)
            st.metric("Memory Usage", f"{memory_usage:.1f}%", delta=None)

            # Progress bar for memory
            st.progress(memory_usage/100)
            st.markdown('</div>', unsafe_allow_html=True)

        with system_col3:
            st.markdown('<div style="background-color:#1a1b2e; padding:15px; border-radius:10px; border:1px solid #2f3156;">', unsafe_allow_html=True)

            # Mock API rate (random value between 1-10)
            api_rate = np.random.uniform(1, 10)
            st.metric("API Calls/min", f"{api_rate:.1f}", delta=None)

            # Use a differently styled progress bar for API rate
            st.markdown(f"""
            <div style="height:20px; background-color:#0f1020; border-radius:5px; margin-top:18px;">
                <div style="width:{min(api_rate/10*100, 100)}%; background-color:#3a86ff; height:100%; border-radius:5px;"></div>
            </div>
            """, unsafe_allow_html=True)
            st.markdown('</div>', unsafe_allow_html=True)

        # Active Services Status
        st.markdown("""
        <h4 style="margin-top:20px; margin-bottom:15px;">Active Services</h4>
        """, unsafe_allow_html=True)

        service_status = {
            "Sentiment Analysis Engine": {"status": "Running", "uptime": "3d 12h", "health": "Good"},
            "Trading Execution Engine": {"status": "Running", "uptime": "3d 12h", "health": "Good"},
            "Market Data Collector": {"status": "Running", "uptime": "3d 11h", "health": "Good"},
            "ML Prediction Model": {"status": "Running", "uptime": "3d 10h", "health": "Warning"},
            "API Gateway": {"status": "Running", "uptime": "3d 12h", "health": "Good"}
        }

        # Create DataFrame for services
        services_df = pd.DataFrame.from_dict(service_status, orient='index').reset_index()
        services_df.columns = ["Service", "Status", "Uptime", "Health"]

        # Function to style the health column
        def style_health(val):
            if val == "Good":
                return f'background-color: rgba(56, 176, 0, 0.2); color: #38b000;'
            elif val == "Warning":
                return f'background-color: rgba(255, 190, 11, 0.2); color: #ffbe0b;'
            else:
                return f'background-color: rgba(217, 4, 41, 0.2); color: #d90429;'

        # Apply the style function to the "Health" column
        styled_services = services_df.style.applymap(lambda v: style_health(v) if v in ["Good", "Warning", "Bad"] else '')

        # Display styled table
        st.dataframe(styled_services, use_container_width=True)

        # Add a footer with dashboard information
        st.markdown("""
        <div style="margin-top:40px; border-top:1px solid #2f3156; padding-top:20px; color:#888; font-size:0.8rem; text-align:center;">
            PortAI Trading Dashboard v2.1 | © 2025 PortAI Technologies
        </div>
        """, unsafe_allow_html=True)

    # Pause between updates
    time.sleep(refresh_rate)
