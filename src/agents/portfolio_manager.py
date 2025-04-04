import os
import csv
from datetime import datetime
from src.utils.enhance_trade_logging import TradeLogger
from src.core.vault import Vault
from src.utils.binance_executor import execute_order
from src.utils.binance_executor import get_binance_balances


vault = Vault()


class PortfolioManager:
    def __init__(self, asset_dict, accuracy_dict, snapshot_dir="logs/snapshots", binance_api_key=None, binance_secret=None, live_mode=True):
        self.live_mode = live_mode
        self.assets = asset_dict  # Dictionary of Asset objects
        self.accuracy = accuracy_dict  # Tracks correct/total predictions per asset
        self.snapshot_dir = snapshot_dir
        os.makedirs(snapshot_dir, exist_ok=True)

        self.BINANCE_API_KEY = vault.get_key("BINANCE_API_KEY", caller="start_live")
        self.BINANCE_SECRET = vault.get_key("BINANCE_SECRET", caller="start_live")
        
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

    def execute_real_order(self, symbol, side, qty, price):
        print(f"🚀 Real Trade Triggered: {symbol} {side} {qty} @ {price}")
        result = execute_order(symbol, side, qty)

        if result:
            order_id = result.get("orderId")
            self.assets[symbol].last_trade_id = order_id
            print(f"✅ Order Executed | ID: {order_id}")
        else:
            print(f"❌ Trade execution failed for {symbol} {side}")

    def calculate_quantity(self, symbol, price, capital_fraction=1.0):
        """
        Calculates how much to buy based on available balance and price.
        `capital_fraction=1.0` uses full balance, set to 0.5 for 50% usage.
        """
        asset = self.assets[symbol]
        available_capital = asset.balance * capital_fraction
        return round(available_capital / price, 6)  
        
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
        self.prices[symbol] = price

    def buy(self, symbol, price):
        quantity = self.calculate_quantity(symbol, price)
        if quantity <= 0:
            print(f"⚠️ Quantity too low for {symbol} at {price}")
            return

        # ✅ Real-time Binance Balance Guard
        if self.live_mode:
            balances = get_binance_balances()
            asset_code = symbol.replace("USDT", "")  # Extract BTC/ETH

            for bal in balances:
                if bal["asset"] == asset_code:
                    if float(bal["free"]) == 0:
                        print(f"⛔ No {asset_code} balance available – skipping real BUY for {symbol}")
                        return

            self.execute_real_order(symbol, "BUY", quantity)
        else:
            print(f"🧪 Simulated BUY: {symbol} {quantity} at {price}")

        self.assets[symbol].buy(price, quantity)
        self.log_trade(symbol, "BUY", price, quantity)
        self.save_snapshot()


    def sell(self, symbol, price):
        quantity = self.assets[symbol].holding
        if quantity <= 0:
            print(f"⚠️ No holding to SELL for {symbol}")
            return

        if self.live_mode:
            self.execute_real_order(symbol, "SELL", quantity)
        else:
            print(f"🧪 Simulated SELL: {symbol} {quantity} at {price}")

        self.assets[symbol].sell(price, quantity)
        self.log_trade(symbol, "SELL", price, quantity)
        self.save_snapshot()

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