import pandas as pd # type: ignore
import numpy as np # type: ignore
from sqlalchemy import create_engine, text # type: ignore
import os
from sklearn.metrics import precision_score, recall_score, f1_score # type: ignore

# Load database connection
DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    raise ValueError("❌ ERROR: DATABASE_URL is not set! Set it and restart the script.")

print(f"✅ Using DATABASE_URL: {DB_URL}")
engine = create_engine(DB_URL)

# Fetch trend data from PostgreSQL
def fetch_trend_data(symbol, lookahead=12):
    query = f"""
    SELECT timestamp, bb_mid AS close, trend  -- Using bb_mid instead of close
    FROM "TechnicalIndicators"
    WHERE symbol = '{symbol}'
    ORDER BY timestamp ASC
    """
    df = pd.read_sql(query, engine)

    # Shift bb_mid to calculate future returns
    df["future_close"] = df["close"].shift(-lookahead)

    # Compute actual future price movement
    df["price_change"] = df["future_close"] - df["close"]
    df["actual_trend"] = np.where(df["price_change"] > 0.1, "Bullish",
                              np.where(df["price_change"] < -0.1, "Bearish", "Neutral"))

    return df.dropna()  # Drop NaNs from last few rows

# Compute backtest performance
def evaluate_performance(df):
    y_true = df["actual_trend"]
    y_pred = df["trend"]

    precision = precision_score(y_true, y_pred, average="weighted", zero_division=0)
    recall = recall_score(y_true, y_pred, average="weighted", zero_division=0)
    f1 = f1_score(y_true, y_pred, average="weighted", zero_division=0)

    print(df[["timestamp", "trend", "actual_trend"]].tail(20)) 

    accuracy = (y_true == y_pred).mean() * 100

    print("\n📊 **Backtest Results:**")
    print(f"✅ Accuracy: {accuracy:.2f}%")
    print(f"✅ Precision: {precision:.2f}")
    print(f"✅ Recall: {recall:.2f}")
    print(f"✅ F1 Score: {f1:.2f}")

# Run backtesting for BTCUSDT & ETHUSDT
for symbol in ["BTCUSDT", "ETHUSDT"]:
    print(f"\n🔍 Backtesting AI Trend Predictions for {symbol}...")
    df = fetch_trend_data(symbol)
    evaluate_performance(df)

print("\n🎯 **Backtesting Completed Successfully!**")