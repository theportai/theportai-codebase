import csv
import os
from datetime import datetime

class TradeLogger:

    def __init__(self, log_file='logs/trade_log.csv'):
        self.trades = []  
        self.log_file = log_file

        # ✅ Ensure logs directory exists
        os.makedirs(os.path.dirname(self.log_file), exist_ok=True)

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
        
        self.trades.append({
            'timestamp': datetime.utcnow().strftime('%Y-%m-%d'),
            'action': action,
            'price': price,
            'pnl': pnl if pnl else 0
        })

        print(f"📝 TRADE LOGGED: {action.upper()} at ${price} | PnL: ${pnl if pnl else 0:.2f}")
        print(f"[DEBUG] Logging to: {self.log_file}")
        print(f"[DEBUG] Data: {timestamp}, {action}, {price}, {pnl}")