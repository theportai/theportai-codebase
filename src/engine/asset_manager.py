class Asset:
    def __init__(self, symbol, base_currency, quote_currency, starting_balance=10000):
        self.symbol = symbol.lower()
        self.base_currency = base_currency
        self.quote_currency = quote_currency
        self.balance = starting_balance
        self.holdings = 0  # initially holding no assets
        self.last_price = 0
        self.total_trades = 0
        self.winning_trades = 0
        self.trade_history = []  # Added trade history list to store each trade record

    def buy(self, price, quantity):
        """Buy a specific quantity of the asset at the given price."""
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
        """Sell a specific quantity of the asset at the given price."""
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
        """Display the asset's current status."""
        print(f"[{self.symbol.upper()}] BALANCE: ${self.balance:.2f} | HOLDINGS: {self.holdings:.4f} {self.base_currency} | PnL: ${self.get_pnL():.2f} | Trades: {self.total_trades} | Wins: {self.winning_trades}")
    
    def get_pnL(self):
        """Calculate and return the PnL based on the last price and holdings."""
        return self.holdings * self.last_price - self.balance

    def get_trade_history(self):
        """Return the trade history of the asset."""
        return self.trade_history

    def calculate_wins(self):
        """Calculate the number of winning trades."""
        return self.winning_trades