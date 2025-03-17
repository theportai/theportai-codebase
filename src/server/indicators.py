import pandas as pd
import numpy as np
import pandas_ta as ta
from sqlalchemy import create_engine, text
import os

# ✅ Load Database URL
DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    raise ValueError("❌ ERROR: DATABASE_URL is not set! Set it and restart the script.")

print(f"✅ Using DATABASE_URL: {DB_URL}")

# ✅ Create Database Connection
engine = create_engine(DB_URL)

# ✅ Function to Fetch Market Data
def fetch_market_data(symbol, limit=1000):
    query = text(f"""
    SELECT timestamp, close
    FROM "CryptoPrice" 
    WHERE symbol = :symbol
    ORDER BY timestamp DESC 
    LIMIT :limit
    """)
    
    with engine.connect() as connection:
        df = pd.read_sql(query, connection, params={"symbol": symbol, "limit": limit})

    if df.empty:
        print(f"⚠️ No data found for {symbol}. Skipping...")
        return df

    # ✅ Ensure timestamps are properly rounded
    df["timestamp"] = pd.to_datetime(df["timestamp"]).dt.floor("s")

    return df

# ✅ Function to Compute Indicators & Classify Trends
def compute_indicators(df):
    if df.empty:
        return df

    df["timestamp"] = pd.to_datetime(df["timestamp"]).dt.floor("s")

    # ✅ Compute Technical Indicators
    df["SMA_14"] = df["close"].rolling(window=14, min_periods=1).mean()
    df["EMA_14"] = df["close"].ewm(span=14, adjust=False).mean()
    df["RSI_14"] = ta.rsi(df["close"], length=14)

    # ✅ Compute MACD
    macd = ta.macd(df["close"])
    if macd is not None and not macd.empty:
        df["MACD"] = macd["MACD_12_26_9"]
        df["MACD_Signal"] = macd["MACDs_12_26_9"]
        df["MACD_Hist"] = macd["MACDh_12_26_9"]
    else:
        df["MACD"], df["MACD_Signal"], df["MACD_Hist"] = np.nan, np.nan, np.nan
        print("⚠️ MACD computation failed. Defaulting to NaN.")

    # ✅ Compute Bollinger Bands
    bb = ta.bbands(df["close"], length=20, std=2.5)  
    if bb is not None and not bb.empty:
        df["BB_High"] = bb["BBU_20_2.5"]
        df["BB_Mid"] = bb["BBM_20_2.5"]
        df["BB_Low"] = bb["BBL_20_2.5"]
    else:
        df["BB_High"], df["BB_Mid"], df["BB_Low"] = np.nan, np.nan, np.nan
        print("⚠️ Bollinger Bands computation failed. Defaulting to NaN.")

    # ✅ Trend Classification
    conditions = [
        (df["RSI_14"] > 50) & (df["MACD"] > df["MACD_Signal"]) & (df["close"] >= df["BB_Mid"]),
        (df["RSI_14"] < 50) & (df["MACD"] < df["MACD_Signal"]) & (df["close"] <= df["BB_Mid"])
    ]
    choices = ["Bullish 🟢", "Bearish 🔴"]
    df["Trend"] = np.select(conditions, choices, default="Neutral ⚪")

    return df

# ✅ Store Indicators in PostgreSQL
def store_indicators(df, symbol):
    if df.empty:
        print(f"⚠️ No data to store for {symbol}. Skipping...")
        return

    df = df.dropna()
    df["timestamp"] = pd.to_datetime(df["timestamp"]).dt.floor("s")

    with engine.connect() as connection:
        for _, row in df.iterrows():
            query = text("""
            INSERT INTO "TechnicalIndicators" 
                (symbol, timestamp, sma_14, ema_14, rsi_14, macd, macd_signal, macd_hist, bb_high, bb_mid, bb_low, trend) 
            VALUES 
                (:symbol, :timestamp, :sma_14, :ema_14, :rsi_14, :macd, :macd_signal, :macd_hist, :bb_high, :bb_mid, :bb_low, :trend) 
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
            try:
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
                connection.commit()
            except Exception as e:
                print(f"❌ Error storing data for {symbol} at {row.timestamp}: {e}")

# ✅ Process Indicators for Each Symbol
def process_indicators(symbol):
    print(f"🔹 Processing {symbol}...")
    df = fetch_market_data(symbol)
    if df.empty:
        return

    df = compute_indicators(df)
    store_indicators(df, symbol)
    print(f"✅ {symbol} processed successfully!\n")

# ✅ Run for BTCUSDT & ETHUSDT
process_indicators("BTCUSDT")
process_indicators("ETHUSDT")

print("✅ Market Trends Successfully Classified & Stored in PostgreSQL!")