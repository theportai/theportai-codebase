import pandas as pd # type: ignore
from sqlalchemy import create_engine, text # type: ignore
import os

def get_ohlcv_from_db(symbol="BTCUSDT", limit=1000):
    DB_URL = os.getenv("DATABASE_URL")
    if not DB_URL:
        raise ValueError("DATABASE_URL not set")

    engine = create_engine(DB_URL)

    query = text(f"""
        SELECT timestamp, open, high, low, close, volume
        FROM "CryptoPrice"
        WHERE symbol = :symbol
        ORDER BY timestamp DESC
        LIMIT :limit
    """)

    with engine.connect() as conn:
        df = pd.read_sql(query, conn, params={"symbol": symbol, "limit": limit})

    df = df.sort_values("timestamp")  # oldest to newest

    return [
        {
            "timestamp": row["timestamp"].strftime("%Y-%m-%d"),
            "open": float(row["open"]),
            "high": float(row["high"]),
            "low": float(row["low"]),
            "close": float(row["close"]),
            "volume": float(row["volume"])
        }
        for _, row in df.iterrows()
    ]