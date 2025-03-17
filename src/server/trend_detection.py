import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
import os

DB_URL = os.getenv("DATABASE_URL")
engine = create_engine(DB_URL)

def compute_trend(df):
    """
    Improved AI Trend Classification using:
    - RSI (Relative Strength Index)
    - MACD (Moving Average Convergence Divergence)
    - Bollinger Band Midpoint
    """
    df["bb_mid_previous"] = df["bb_mid"].shift(1)
    df["bb_mid_before"] = df["bb_mid"].shift(2)

    df["trend"] = "Neutral"  # Default Neutral

    # **Using RSI for Bullish/Bearish Strength**
    df.loc[df["rsi_14"] > 60, "trend"] = "Bullish"
    df.loc[df["rsi_14"] < 40, "trend"] = "Bearish"

    # **Using MACD for Confirmation**
    df.loc[df["macd"] > df["macd_signal"], "trend"] = "Bullish"
    df.loc[df["macd"] < df["macd_signal"], "trend"] = "Bearish"

    # **Using Bollinger Band Midpoint for Trend Validation**
    df.loc[(df["bb_mid"] > df["bb_mid_previous"]) & (df["bb_mid_previous"] > df["bb_mid_before"]), "trend"] = "Bullish"
    df.loc[(df["bb_mid"] < df["bb_mid_previous"]) & (df["bb_mid_previous"] < df["bb_mid_before"]), "trend"] = "Bearish"

    return df

def update_trends():
    """
    Fetch data, compute trends using AI, and update the database.
    """
    query = """
    SELECT id, timestamp, bb_mid, rsi_14, macd, macd_signal 
    FROM "TechnicalIndicators" 
    ORDER BY timestamp ASC
    """
    df = pd.read_sql(query, engine)

    df = compute_trend(df)

    # ✅ Update database with new trend classifications
    with engine.begin() as conn:
        for _, row in df.iterrows():
            update_query = text("""
                UPDATE "TechnicalIndicators"
                SET trend = :trend
                WHERE id = :id
            """)
            conn.execute(update_query, {"trend": row.trend, "id": row.id})

    print("✅ AI-Based Trend Classification Updated Successfully!")

if __name__ == "__main__":
    update_trends()