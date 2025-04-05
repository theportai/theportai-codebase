from src.utils.binance_executor import get_binance_balances

class Asset:
    def __init__(self, symbol, base_currency, quote_currency, starting_balance=10000, live_mode=False):
        self.symbol = symbol.lower()
        self.base_currency = base_currency
        self.quote_currency = quote_currency
        self.last_price = 0
        self.total_trades = 0
        self.winning_trades = 0
        self.trade_history = []

        if live_mode:
            print(f"🔐 Live mode enabled – syncing {symbol.upper()} from Binance wallet...")
            balances = get_binance_balances()
            asset_code = base_currency.upper()

            if self.symbol.endswith("usdt"):
                self.balance = balances.get("USDT", 0.0)
                self.holdings = balances.get(asset_code, 0.0)
            else:
                self.balance = 0.0
                self.holdings = 0.0
        else:
            self.balance = starting_balance
            self.holdings = 0.0

    def buy(self, price, quantity):
        cost = price * quantity
        if cost > self.balance:
            print(f"❌ Not enough balance to buy {quantity} {self.symbol.upper()} at {price}")
            return
        self.last_price = price
        self.holdings += quantity
        self.balance -= cost
        self.total_trades += 1
        self.trade_history.append({"type": "buy", "price": price, "qty": quantity})
        print(f"✅ Bought {quantity:.4f} {self.symbol.upper()} at ${price} | New Holdings: {self.holdings:.4f}")

    def sell(self, price, quantity):
        if quantity > self.holdings:
            print(f"❌ Not enough holdings to sell {quantity} {self.symbol.upper()}")
            return
        self.balance += price * quantity
        self.holdings -= quantity
        self.total_trades += 1
        self.trade_history.append({"type": "sell", "price": price, "qty": quantity})
        
        if price > self.last_price:
            self.winning_trades += 1
            print(f"✅ Sold {quantity:.4f} {self.symbol.upper()} at ${price} (Win)")
        else:
            print(f"⚠️ Sold {quantity:.4f} {self.symbol.upper()} at ${price} (Loss)")

    def status(self):
        print(f"[{self.symbol.upper()}] BALANCE: ${self.balance:.2f} | HOLDINGS: {self.holdings:.4f} {self.base_currency} | PnL: ${self.get_pnL():.2f} | Trades: {self.total_trades} | Wins: {self.winning_trades}")
    
    def get_pnL(self):
        return self.holdings * self.last_price - self.balance

    def get_trade_history(self):
        return self.trade_history

    def calculate_wins(self):
        return self.winning_trades