import pandas as pd
import numpy as np
import pandas_ta as ta
from sqlalchemy import create_engine, text
import os

DB_URL = os.getenv("DATABASE_URL")

if not DB_URL:
    raise ValueError("❌ ERROR: DATABASE_URL is not set! Set it and restart the script.")

print(f"✅ Using DATABASE_URL: {DB_URL}")

engine = create_engine(DB_URL)

# Function to fetch OHLCV data
def fetch_market_data(symbol, limit=500):
    query = f"""
    SELECT timestamp, close
    FROM "CryptoPrice" 
    WHERE symbol = '{symbol}' 
    ORDER BY timestamp DESC 
    LIMIT {limit}
    """
    df = pd.read_sql(query, engine)
    return df

# ✅ Function to compute indicators & classify trends
def compute_indicators(df):
    df = df.sort_values("timestamp")  # Ensure proper order

    # Compute Indicators
    df["SMA_14"] = df["close"].rolling(window=14).mean()
    df["EMA_14"] = df["close"].ewm(span=14, adjust=False).mean()
    df["RSI_14"] = ta.rsi(df["close"], length=14)
    
    macd = ta.macd(df["close"])
    df["MACD"] = macd["MACD_12_26_9"]
    df["MACD_Signal"] = macd["MACDs_12_26_9"]
    df["MACD_Hist"] = macd["MACDh_12_26_9"]

    bb = ta.bbands(df["close"], length=20, std=2)
    df["BB_High"] = bb["BBU_20_2.0"]
    df["BB_Mid"] = bb["BBM_20_2.0"]
    df["BB_Low"] = bb["BBL_20_2.0"]

    # ✅ Trend Classification
    conditions = [
        (df["RSI_14"] > 55) & (df["MACD"] > df["MACD_Signal"]) & (df["close"] >= df["BB_High"]),
        (df["RSI_14"] < 45) & (df["MACD"] < df["MACD_Signal"]) & (df["close"] <= df["BB_Low"])
    ]
    choices = ["Bullish 🟢", "Bearish 🔴"]
    df["Trend"] = np.select(conditions, choices, default="Neutral ⚪")

    return df

# ✅ Store indicators in PostgreSQL
def store_indicators(df, symbol):
    df = df.dropna()  # Drop NaN values before storing

    with engine.connect() as connection:
        for _, row in df.iterrows():
            query = text(f"""
            INSERT INTO "TechnicalIndicators" (symbol, timestamp, sma_14, ema_14, rsi_14, macd, macd_signal, macd_hist, bb_high, bb_mid, bb_low, trend) 
            VALUES (:symbol, :timestamp, :sma_14, :ema_14, :rsi_14, :macd, :macd_signal, :macd_hist, :bb_high, :bb_mid, :bb_low, :trend) 
            ON CONFLICT (symbol, timestamp) DO UPDATE 
            SET sma_14 = EXCLUDED.sma_14, 
                ema_14 = EXCLUDED.ema_14, 
                rsi_14 = EXCLUDED.rsi_14, 
                macd = EXCLUDED.macd, 
                macd_signal = EXCLUDED.macd_signal, 
                macd_hist = EXCLUDED.macd_hist, 
                bb_high = EXCLUDED.bb_high, 
                bb_mid = EXCLUDED.bb_mid, 
                bb_low = EXCLUDED.bb_low,
                trend = EXCLUDED.trend;
            """)
            connection.execute(query, {
                "symbol": symbol,
                "timestamp": row.timestamp,
                "sma_14": row.SMA_14,
                "ema_14": row.EMA_14,
                "rsi_14": row.RSI_14,
                "macd": row.MACD,
                "macd_signal": row.MACD_Signal,
                "macd_hist": row.MACD_Hist,
                "bb_high": row.BB_High,
                "bb_mid": row.BB_Mid,
                "bb_low": row.BB_Low,
                "trend": row.Trend
            })
        connection.commit()  # ✅ Commit changes

# ✅ Process Indicators for Each Symbol
def process_indicators(symbol):
    df = fetch_market_data(symbol)
    df = compute_indicators(df)
    store_indicators(df, symbol)

# ✅ Run for BTCUSDT & ETHUSDT
process_indicators("BTCUSDT")
process_indicators("ETHUSDT")

print("✅ Market Trends Successfully Classified (Bullish 🟢 / Bearish 🔴 / Neutral ⚪) & Stored in PostgreSQL!")