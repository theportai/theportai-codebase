import time, hmac, hashlib, requests, csv # type: ignore
from urllib.parse import urlencode
from datetime import datetime
from src.core.vault import Vault

BASE_URL = "https://api.binance.com"

vault = Vault()
API_KEY = vault.get_key("BINANCE_API_KEY", caller="binance_client")
API_SECRET = vault.get_key("BINANCE_SECRET", caller="binance_client")


def generate_signature(params: dict, secret_key: str) -> str:
    query_string = urlencode(params)
    return hmac.new(secret_key.encode('utf-8'),
                    query_string.encode('utf-8'),
                    hashlib.sha256).hexdigest()


def execute_order(symbol, side, quantity, retries=3):
    path = "/api/v3/order"
    url = BASE_URL + path

    params = {
        "symbol": symbol,
        "side": side,
        "type": "MARKET",
        "quantity": quantity,
        "timestamp": int(time.time() * 1000),
        "recvWindow": 5000
    }

    params["signature"] = generate_signature(params, API_SECRET)
    headers = {"X-MBX-APIKEY": API_KEY}

    for attempt in range(retries):
        try:
            response = requests.post(url, headers=headers, params=params, timeout=10)
            data = response.json()

            if response.status_code == 200:
                log_order_response(data, "success")
                print(f"✅ Order Success | {symbol} {side} {quantity} | Order ID: {data.get('orderId')}")
                return data
            else:
                log_order_response(data, "failure")
                print(f"⚠️ Order Failed | Attempt {attempt+1}/{retries} | {data}")
                if data.get("code") in [-1003, -1013, -1021, -1100]:
                    time.sleep(2)
                    continue
                break
        except Exception as e:
            print(f"🔁 Retry {attempt+1}/{retries} | Network error: {e}")
            time.sleep(2)
    return None


def get_binance_balances():
    timestamp = int(time.time() * 1000)
    params = {
        "timestamp": timestamp,
        "recvWindow": 5000
    }

    params["signature"] = generate_signature(params, API_SECRET)
    headers = {"X-MBX-APIKEY": API_KEY}

    balances = data.get("balances", [])
    tracked_assets = {"BTC", "ETH", "USDT"}
    nonzero_assets = {b['asset']: float(b['free']) for b in balances if b['asset'] in tracked_assets}

    if not any(amount > 0 for amount in nonzero_assets.values()):
        print("⚠️ No tradeable balance found!")
        print("💡 Please deposit USDT, BTC or ETH in your Spot wallet before trading.")
    else:
        for asset, amount in nonzero_assets.items():
            print(f"💰 {asset}: {amount}")

    try:
        response = requests.get(BASE_URL + "/api/v3/account", headers=headers, params=params, timeout=10)
        data = response.json()

        if response.status_code == 200:
            return data.get("balances", [])
        else:
            print(f"❌ Failed to fetch balances | Response: {data}")
            return []
    except Exception as e:
        print(f"⚠️ Network error during balance fetch: {str(e)}")
        return []

    



def log_order_response(data, status="success"):
    filename = f"logs/order_{status}.csv"
    with open(filename, "a", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            datetime.utcnow(),
            data.get("symbol"),
            data.get("side"),
            data.get("orderId"),
            data.get("status"),
            data.get("executedQty"),
            data.get("cummulativeQuoteQty"),
            str(data.get("fills", []))[:100]
        ])