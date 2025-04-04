from src.utils.binance_executor import get_binance_balances

print("🔄 Fetching Binance balances...")
balances = get_binance_balances()

# Track if any balance is non-zero
has_balance = False

for bal in balances:
    asset = bal.get("asset")
    free = float(bal.get("free", 0))

    # Only print common tokens
    if asset in ["BTC", "ETH", "USDT"] or free > 0:
        print(f"💰 {asset}: {free}")
    
    if free > 0:
        has_balance = True

if not has_balance:
    print("\n⚠️ No tradeable balance found!")
    print("💡 Please deposit USDT, BTC or ETH in your Spot wallet before trading.\n")