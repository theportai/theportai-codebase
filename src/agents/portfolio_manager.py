import os
import csv
from datetime import datetime
from src.utils.enhance_trade_logging import TradeLogger


class PortfolioManager:
    def __init__(self, asset_dict, accuracy_dict, snapshot_dir="logs/snapshots"):
        self.assets = asset_dict  # Dictionary of Asset objects
        self.accuracy = accuracy_dict  # Tracks correct/total predictions per asset
        self.snapshot_dir = snapshot_dir
        os.makedirs(snapshot_dir, exist_ok=True)

        self.prices = {}

        self.trade_logger = TradeLogger()

        self.entry_price = {
            "BTCUSDT": None,
            "ETHUSDT": None
        }
        self.sl_tp_log_path = "logs/sl_tp_events.csv"
        os.makedirs("logs", exist_ok=True)  # Ensure logs folder
        with open(self.sl_tp_log_path, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["timestamp", "symbol", "exit_type", "entry_price", "exit_price", "pnl"])

    def check_sl_tp(self, symbol, price, sl_pct=0.01, tp_pct=0.02):
        """
        Check whether Stop Loss or Take Profit was hit.
        Returns: "tp", "sl", or None
        """
        entry_price = getattr(self, "entry_price", {}).get(symbol)
        if not entry_price:
            return None

        if price >= entry_price * (1 + tp_pct):
            return "tp"
        elif price <= entry_price * (1 - sl_pct):
            return "sl"
        return None

    def update_price(self, symbol, price):
        if symbol in self.assets:
            self.assets[symbol].update_price(price)

    def buy(self, symbol, price):
        quantity = self.balances[symbol] / price
        self.holdings[symbol] += quantity
        self.balances[symbol] = 0.0
        self.trades[symbol] += 1
        self.entry_price[symbol] = price

    def sell(self, symbol, price, correct=True):
        symbol = symbol.lower()
        if symbol not in self.assets:
            print(f"⚠️ Asset {symbol} not found in portfolio.")
            return

        asset = self.assets[symbol]
        proceeds = asset.holdings * price
        asset.balance += proceeds
        asset.holdings = 0.0
        asset.trade_count = getattr(asset, 'trade_count', 0) + 1

        if correct:
            asset.win_count = getattr(asset, 'win_count', 0) + 1

        # ✅ SL/TP Event Logging
        entry_price = getattr(asset, 'last_price', None)
        if entry_price is not None:
            exit_type = "tp" if price > entry_price else "sl"
            pnl = proceeds - 10000  # assuming initial investment per asset
            self.trade_logger.log_sl_tp_event(
                symbol=symbol,
                exit_type=exit_type,
                entry_price=entry_price,
                exit_price=price,
                pnl=pnl
            )

    def get_portfolio_value(self, symbol):
        asset = self.assets[symbol]
        return asset.balance + (asset.holdings * asset.price)

    def get_summary(self):
        total_balance = 0.0
        total_trades = 0
        total_wins = 0
        summary = {}

        for symbol, asset in self.assets.items():
            value = asset.balance + (asset.holdings * asset.price)
            pnl = value - 10000  # Initial balance assumed 10k
            accuracy = (asset.win_count / asset.trade_count) * 100 if asset.trade_count > 0 else 0.0

            summary[symbol] = {
                "USD Value": round(value, 2),
                "PnL": round(pnl, 2),
                "Trades": asset.trade_count,
                "Accuracy": round(accuracy, 2)
            }

            total_balance += value
            total_trades += asset.trade_count
            total_wins += asset.win_count

        summary["Total"] = {
            "USD Value": round(total_balance, 2),
            "PnL": round(total_balance - 10000 * len(self.assets), 2),
            "Trades": total_trades,
            "Wins": total_wins
        }

        return summary

    def save_snapshot(self):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        snapshot_file = os.path.join(self.snapshot_dir, "portfolio_snapshots.csv")
        write_header = not os.path.exists(snapshot_file)

        with open(snapshot_file, mode='a', newline='') as f:
            writer = csv.writer(f)
            if write_header:
                writer.writerow(["timestamp", "symbol", "balance", "holdings", "pnl", "trades", "accuracy"])

            for symbol, asset in self.assets.items():
                #value = asset.balance + (asset.holdings * asset.price)
                price = self.prices.get(symbol, 0.0)
                value = asset.balance + (asset.holdings * price)
                pnl = value - 10000
                accuracy = (asset.win_count / asset.trade_count) * 100 if asset.trade_count > 0 else 0.0

                writer.writerow([
                    timestamp,
                    symbol.upper(),
                    round(asset.balance, 2),
                    round(asset.holdings, 4),
                    round(pnl, 2),
                    asset.trade_count,
                    round(accuracy, 2)
                ])

    def save_portfolio_snapshot(self):
        self.save_snapshot()