import csv
import os
from datetime import datetime
import pandas as pd # type: ignore


class TradeLogger:
    def __init__(self, base_dir="logs/trades"):
        os.makedirs(base_dir, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        self.filename = os.path.join(base_dir, f"trade_log_{timestamp}.csv")
        
        # Initialize the CSV file with headers
        with open(self.filename, mode='w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                "timestamp", "symbol", "action", "price", "confidence",
                "correct", "total_trades", "accuracy", "rolling_accuracy"
            ])

    def log_sl_tp_event(self, symbol, exit_type, entry_price, exit_price, pnl):
        with open("logs/sl_tp_events.csv", mode="a", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                symbol.upper(),
                exit_type,
                round(entry_price, 2),
                round(exit_price, 2),
                round(pnl, 2)
            ])

    def log_trade(
        self,
        symbol: str,
        action: str,
        price: float,
        confidence: float,
        correct: bool,
        total_trades: int,
        accuracy: float,
        rolling_acc: float = None
    ):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(self.filename, mode='a', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                timestamp,
                symbol,
                action,
                round(price, 2),
                round(confidence, 4),
                correct,
                total_trades,
                round(accuracy, 2),
                round(rolling_acc, 2) if rolling_acc is not None else ""
            ])