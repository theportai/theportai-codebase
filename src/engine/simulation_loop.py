from lib.binance import listen_to_binance

# TEMP — Plug into agents here later
async def handle_price(price):
    print(f"📈 Live Price: {price}")
    # ➕ TODO: Call market_analysis, prediction, etc.

def run_live_simulation():
    import asyncio
    asyncio.run(listen_to_binance(handle_price))