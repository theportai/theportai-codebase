import datetime

class TradeExecutor:
    def __init__(self):
        self.trade_log = []

    def execute_trade(self, action: str, price: float):
        """
        Simulate placing a trade. In real system, this connects to exchange.
        """
        trade = {
            "timestamp": datetime.datetime.utcnow().isoformat(),
            "action": action,
            "price": price
        }

        self.trade_log.append(trade)
        print(f"✅ TRADE EXECUTED → {action.upper()} at ${price}")