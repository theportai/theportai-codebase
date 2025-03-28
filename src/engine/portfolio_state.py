from src.engine.trade_logger import TradeLogger
from src.engine.performance_metrics import calculate_sharpe_ratio


class PortfolioState:
    def __init__(self, starting_balance=10000, logger=None):
        self.balance = starting_balance
        self.holdings = 0
        self.entry_price = None
        self.trade_history = []
        self.realized_pnl = 0
        self.total_trades = 0
        self.winning_trades = 0
        self.logger = logger or TradeLogger()
        self.returns = []


    def buy(self, price):
        if self.holdings == 0:
            self.holdings = self.balance / price
            self.entry_price = price
            self.balance = 0
            self.total_trades += 1
            self.logger.log('buy', price)
            print(f"💰 BOUGHT @ ${price} | Holdings: {self.holdings:.4f} BTC")

    def sell(self, price):
        if self.holdings > 0:
            proceeds = self.holdings * price
            profit = proceeds - (self.holdings * self.entry_price)
            trade_return = (price - self.entry_price) / self.entry_price
            self.returns.append(trade_return)
            self.balance = proceeds
            self.realized_pnl += profit
            self.trade_history.append({
                "entry": self.entry_price,
                "exit": price,
                "profit": profit
            })
            if profit > 0:
                self.winning_trades += 1
            self.holdings = 0
            self.entry_price = None
            self.total_trades += 1
            self.logger.log('sell', price, profit)
            print(f"💸 SOLD @ ${price} | Profit: ${profit:.2f}")

    def status(self):
        unrealized_pnl = 0
        if self.holdings and self.entry_price:
            current_value = self.holdings * self.entry_price
            unrealized_pnl = current_value - (self.holdings * self.entry_price)
        
        if self.returns:
            sharpe = calculate_sharpe_ratio(self.returns)
            print(f"Sharpe Ratio: {sharpe}")

        print(f"\n📊 PORTFOLIO STATUS:")
        print(f"Balance: ${self.balance:.2f}")
        print(f"Holdings: {self.holdings:.4f} BTC")
        print(f"Realized PnL: ${self.realized_pnl:.2f}")
        print(f"Total Trades: {self.total_trades}")
        print(f"Winning Trades: {self.winning_trades}")
        print(f"Win Rate: {self.winning_trades / self.total_trades * 100:.1f}%\n" if self.total_trades else "")