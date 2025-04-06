from src.utils.binance_executor import get_binance_balances
import requests # type: ignore


balances = get_binance_balances()
print(balances)



def fetch_step_size(symbol):
    url = "https://api.binance.com/api/v3/exchangeInfo"
    response = requests.get(url)
    data = response.json()

    for s in data["symbols"]:
        if s["symbol"] == symbol:
            for f in s["filters"]:
                if f["filterType"] == "LOT_SIZE":
                    step_size = float(f["stepSize"])
                    print(f"✅ {symbol} stepSize: {step_size}")
                    return step_size
    print(f"❌ stepSize not found for {symbol}")
    return None

# 🔍 Check for common symbols
fetch_step_size("ETHUSDT")
fetch_step_size("BTCUSDT")
fetch_step_size("SOLUSDT")