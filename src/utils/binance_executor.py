import time, hmac, hashlib, requests, csv # type: ignore
from urllib.parse import urlencode
from datetime import datetime
from src.core.vault import Vault
import json
import math


BASE_URL = "https://api.binance.com"

vault = Vault()
API_KEY = vault.get_key("BINANCE_API_KEY", caller="binance_client")
API_SECRET = vault.get_key("BINANCE_SECRET", caller="binance_client")


def generate_signature(params: dict, secret_key: str) -> str:
    query_string = urlencode(params)
    return hmac.new(secret_key.encode('utf-8'),
                    query_string.encode('utf-8'),
                    hashlib.sha256).hexdigest()

def round_step_size(quantity, step_size):
    precision = int(round(-math.log10(step_size), 0))
    return round(quantity, precision)


def execute_order(symbol, side, quantity, retries=3):
    symbol = symbol.upper()
    path = "/api/v3/order"
    url = BASE_URL + path

    # TEMP: Hardcoded step size (use dynamic fetch later)
    step_size = 0.001
    quantity = round_step_size(quantity, step_size)

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

    for attempt in range(1, retries + 1):
        try:
            response = requests.post(url, headers=headers, params=params, timeout=10)
            data = response.json()

            if response.status_code == 200:
                log_order_response(data, "success")
                print(f"✅ Order Success | {symbol} {side} {quantity} | Order ID: {data.get('orderId')}")
                return data
            else:
                log_order_response(data, "failure")
                print(f"⚠️ Order Failed | Attempt {attempt}/{retries} | {data}")

                # Retry on specific Binance API errors
                if data.get("code") in [-1003, -1013, -1021, -1100]:
                    time.sleep(2)
                    continue
                break
        except Exception as e:
            print(f"🔁 Retry {attempt}/{retries} | Network error: {e}")
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

    try:
        response = requests.get(BASE_URL + "/api/v3/account", headers=headers, params=params, timeout=10)

        if response.status_code == 200:
            data = response.json()
            balances = data.get("balances", [])


            # ✅ Filter tradeable balances
            tracked_assets = {"BTC", "ETH", "USDT"}
            balance_dict = {
                b["asset"]: float(b["free"])
                for b in balances
                if b["asset"] in tracked_assets and float(b["free"]) > 0
            }

            if not balance_dict:
                print("\n⚠️ No tradeable balance found!")
                print("💡 Please deposit USDT, BTC or ETH in your Spot wallet before trading.")
            else:
                print("\n💰 Available Tradeable Balances:")
                for asset, amount in balance_dict.items():
                    print(f"   {asset}: {amount}")

            return balance_dict

        else:
            print(f"❌ Failed to fetch balances | Status Code: {response.status_code} | Response: {response.text}")
            return {}

    except Exception as e:
        print(f"❌ Error fetching Binance balances: {str(e)}")
        return {}

    



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
            #str(data.get("fills", []))[:100]
            json.dumps(data.get("fills", []))[:300]
        ])