import os
import csv
from datetime import datetime
from src.utils.enhance_trade_logging import TradeLogger
from src.core.vault import Vault
from src.utils.binance_executor import execute_order
from src.utils.binance_executor import get_binance_balances, round_step_size
import math
import time

vault = Vault()

# ✅ Step sizes per asset (from Binance exchange info)
STEP_SIZE_MAP = {
    "BTCUSDT": 0.00001,
    "ETHUSDT": 0.0001,
    "SOLUSDT": 0.001
}

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

        self.entry_price = {s.upper(): None for s in self.assets.keys()}

        self.sl_tp_log_path = "logs/sl_tp_events.csv"
        os.makedirs("logs", exist_ok=True)
        with open(self.sl_tp_log_path, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["timestamp", "symbol", "exit_type", "entry_price", "exit_price", "pnl"])

    def execute_real_order(self, symbol, side, qty, price):
        print(f"\U0001F680 Real Trade Triggered: {symbol} {side} {qty} @ {price}")
        
        max_attempts = 3
        for attempt in range(1, max_attempts + 1):
            try:
                result = execute_order(symbol, side, qty)
                
                if result:
                    order_id = result.get("orderId")
                    self.assets[symbol].last_trade_id = order_id
                    print(f"✅ Order Success | {symbol} {side} {qty} | Order ID: {order_id}")
                    return result
                else:
                    print(f"⚠️ Order Failed | Attempt {attempt}/{max_attempts} | Order returned no result")
                    
            except Exception as e:
                print(f"⚠️ Order Failed | Attempt {attempt}/{max_attempts} | {e}")
            
            # If this was our last attempt, give up
            if attempt == max_attempts:
                print(f"❌ Final Order Failure: {symbol} {side} {qty}")
                break
                
            # Wait briefly before retrying
            time.sleep(1)
        
        return None

    def log_summary(self):
        print("📊 Final Portfolio Summary:")
        for symbol, asset in self.assets.items():
            print(f"{symbol} → Balance: {asset.balance:.2f}, PnL: {asset.pnl:.2f}, Trades: {asset.trade_count}, Wins: {asset.win_count}")

    def calculate_quantity(self, symbol, price, capital_fraction=1.0):
        symbol = symbol.upper()
        asset = self.assets[symbol]
        available_capital = asset.balance * capital_fraction        
        min_notional = 5.0  
        raw_quantity = available_capital / price
        # Check if trade value is above the min notional threshold
        if raw_quantity * price < min_notional:
            print(f"⚠️ Order too small! Notional = ${raw_quantity * price:.2f} — must be ≥ ${min_notional}")
            return 0.0

        # ✅ Round properly to prevent Binance step size rejection
        step_size = STEP_SIZE_MAP.get(symbol, 0.001)        
        quantity = round_step_size(raw_quantity, step_size)
        return quantity

    def check_sl_tp(self, symbol, price, sl_pct=0.01, tp_pct=0.02):
        entry_price = getattr(self, "entry_price", {}).get(symbol)
        if not entry_price:
            return None

        if price >= entry_price * (1 + tp_pct):
            return "tp"
        elif price <= entry_price * (1 - sl_pct):
            return "sl"
        return None

    def update_price(self, symbol, price):
        symbol = symbol.upper()
        if symbol in self.assets:
            self.assets[symbol].update_price(price)
        self.prices[symbol] = price

    def log_trade(self, symbol, side, price, quantity, confidence=0.0, live=False):
        symbol = symbol.upper()
        log_file = "logs/real_trade_log.csv" if live else "logs/simulated_trade_log.csv"
        os.makedirs("logs", exist_ok=True)

        with open(log_file, mode="a", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                datetime.now().isoformat(),
                symbol.upper(),
                side.upper(),
                f"{price:.2f}",
                f"{quantity:.4f}",
                f"{confidence:.4f}",
                "LIVE" if live else "SIMULATION"
            ])

    def buy(self, symbol, price, quantity=None, confidence=0.0, live=False):
        symbol = symbol.upper()
        asset_code = symbol.replace("USDT", "")
        
        # Calculate quantity if not given
        if quantity is None:
            quantity = self.calculate_quantity(symbol, price)

        if quantity <= 0:
            print(f"⚠️ Quantity too low for {symbol} at {price}")
            return

        if self.live_mode:
            balances = get_binance_balances()
            usdt_available = balances.get("USDT", 0.0)
            required_usdt = price * quantity

            # Float-safe capital check
            if usdt_available + 0.01 < required_usdt:
                print(f"⛔ Not enough USDT to buy {symbol} — Required: {required_usdt:.2f}, Available: {usdt_available:.2f}")
                return

            # Execute real order and only proceed if successful
            result = self.execute_real_order(symbol, "BUY", quantity, price)
            if not result:
                print(f"❌ Order failed for {symbol} — skipping portfolio update")
                return
        else:
            print(f"🧪 Simulated BUY: {symbol} {quantity:.6f} at {price:.2f}")

        # ✅ Update portfolio only if real/simulated buy confirmed
        self.assets[symbol].buy(price, quantity)
        self.log_trade(symbol, "BUY", price, quantity, confidence, live)
        self.save_snapshot()

    def sell(self, symbol, price, quantity=None, confidence=0.0, live=False, correct=None):
        symbol = symbol.upper()
        asset = self.assets[symbol]

        if asset.holdings <= 0:
            print(f"⚠️ No holdings to SELL for {symbol}")
            return False

        step_size = STEP_SIZE_MAP.get(symbol, 0.001)
        
        min_notional = 20 
        
        min_quantity = min_notional / price
        min_quantity = math.ceil(min_quantity / step_size) * step_size
        
        if quantity is None or quantity <= 0 or quantity >= asset.holdings:
            buffer_ratio = 0.95
            
            raw_quantity = asset.holdings * buffer_ratio
            
            quantity = math.floor(raw_quantity / step_size) * step_size
            
            print(f"🔄 Selling with safety margin: {quantity:.8f} {symbol.upper()} (Original: {asset.holdings:.8f})")
        
        notional_value = quantity * price
        if notional_value < min_notional:
            if asset.holdings * price >= min_notional:
                # If total holdings meet minimum, use the minimum quantity
                quantity = min_quantity
                print(f"⚠️ Adjusted quantity to meet minimum notional: {quantity:.8f} {symbol.upper()} (${notional_value:.2f} → ${quantity * price:.2f})")
            else:
                print(f"❌ Cannot sell - total holdings value (${asset.holdings * price:.2f}) below minimum notional (${min_notional:.2f})")
                return False
        
        if quantity <= 0:
            print(f"❌ Invalid quantity ({quantity:.8f}) — aborting SELL for {symbol}")
            return False
        
        if quantity > asset.holdings:
            quantity = math.floor(asset.holdings / step_size) * step_size
            print(f"⚠️ Adjusted quantity to match holdings: {quantity:.8f} {symbol.upper()}")

        print(f"🧾 Wallet: {asset.holdings:.8f} {asset.base_currency} | Attempting to SELL: {quantity:.8f}")
        print(f"🧾 Wallet Free: {asset.holdings:.8f} {asset.base_currency} | Attempting to SELL: {quantity:.8f}")

        if correct is not None:
            if correct:
                print(f"✅ Model CORRECT on SELL for {symbol}")
            else:
                print(f"❌ Model INCORRECT on SELL for {symbol}")

        result = None
        if self.live_mode and live:
            result = self.execute_real_order(symbol, "SELL", quantity, price)

        if result is not None or not self.live_mode or not live:
            actual_quantity = quantity
            if result and 'executedQty' in result:
                actual_quantity = float(result['executedQty'])
                
            asset.sell(price, actual_quantity)
            
            if self.live_mode and live:
                print(f"🔴 SELL EXECUTED at ${price:.2f} | Confidence: {confidence:.2f} | Quantity: {actual_quantity}")
            else:
                print(f"[SIMULATION] SELL {symbol} at ${price:.2f} | Confidence: {confidence:.2f}")
                
            if hasattr(self, "log_trade"):
                self.log_trade(symbol, "SELL", price, actual_quantity, confidence, live)
            self.save_snapshot()
            return True
        else:
            print(f"❌ Trade execution failed for {symbol} SELL")
            return False

    def get_portfolio_value(self, symbol):
        symbol = symbol.upper()
        asset = self.assets[symbol]
        price = self.prices.get(symbol, asset.last_price)
        return asset.balance + (asset.holdings * price)

    def get_summary(self):
        total_balance = 0.0
        total_trades = 0
        total_wins = 0
        summary = {}

        for symbol, asset in self.assets.items():
            price = self.prices.get(symbol, asset.last_price)
            value = asset.balance + (asset.holdings * price)
            pnl = value - asset.initial_balance if hasattr(asset, "initial_balance") else value - 10000
            accuracy = (asset.winning_trades / asset.total_trades) * 100 if asset.total_trades > 0 else 0.0

            summary[symbol] = {
                "USD Value": round(value, 2),
                "PnL": round(pnl, 2),
                "Trades": asset.total_trades,
                "Accuracy": round(accuracy, 2)
            }

            total_balance += value
            total_trades += asset.total_trades
            total_wins += asset.winning_trades

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
                price = self.prices.get(symbol, asset.last_price)
                value = asset.balance + (asset.holdings * price)
                pnl = value - asset.initial_balance if hasattr(asset, "initial_balance") else value - 10000
                accuracy = (asset.winning_trades / asset.total_trades) * 100 if asset.total_trades > 0 else 0.0

                writer.writerow([
                    timestamp,
                    symbol.upper(),
                    round(asset.balance, 2),
                    round(asset.holdings, 4),
                    round(pnl, 2),
                    asset.total_trades,
                    round(accuracy, 2)
                ])
        return snapshot_file  # Return the file path

    def save_portfolio_snapshot(self):
        return self.save_snapshot()  # Return the path from save_snapshot