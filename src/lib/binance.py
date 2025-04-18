import asyncio
import websockets # type: ignore
import json

# Live Ticker WebSocket URL
BINANCE_WS_URL = "wss://stream.binance.com:9443/ws/btcusdt@ticker"

async def listen_to_binance(on_message):
    async with websockets.connect(BINANCE_WS_URL) as websocket:
        while True:
            try:
                data = await websocket.recv()
                parsed = json.loads(data)
                price = float(parsed["c"])  # "c" = last price
                await on_message(price)
            except Exception as e:
                print(f"❌ Binance WebSocket error: {e}")
                await asyncio.sleep(5)