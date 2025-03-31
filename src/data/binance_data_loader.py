import requests # type: ignore
import time
from datetime import datetime

def get_binance_ohlcv(symbol="BTCUSDT", interval="1d", limit=100):
    url = f"https://api.binance.com/api/v3/klines"
    params = {
        "symbol": symbol,
        "interval": interval,
        "limit": limit
    }

    response = requests.get(url, params=params)
    data = response.json()

    ohlcv_list = []

    for candle in data:
        ohlcv_list.append({
            "timestamp": datetime.utcfromtimestamp(candle[0] / 1000).strftime('%Y-%m-%d'),
            "open": float(candle[1]),
            "high": float(candle[2]),
            "low": float(candle[3]),
            "close": float(candle[4]),
            "volume": float(candle[5])
        })

    return ohlcv_list