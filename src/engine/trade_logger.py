import csv
import os
from datetime import datetime

class TradeLogger:
    def __init__(self, log_file='logs/trade_log.csv'):
        self.log_file = log_file

        # Initialize CSV with headers if file doesn't exist
        if not os.path.exists(self.log_file):
            with open(self.log_file, mode='w', newline='') as file:
                writer = csv.writer(file)
                writer.writerow(['timestamp', 'action', 'price', 'pnl'])

    def log(self, action, price, pnl=None):
        timestamp = datetime.utcnow().isoformat()
        with open(self.log_file, mode='a', newline='') as file:
            writer = csv.writer(file)
            writer.writerow([timestamp, action, price, pnl if pnl else 0])

        print(f"📝 TRADE LOGGED: {action.upper()} at ${price} | PnL: ${pnl if pnl else 0:.2f}")