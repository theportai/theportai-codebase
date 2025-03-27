import argparse
import pandas as pd # type: ignore
import numpy as np # type: ignore
from sqlalchemy import create_engine, text # type: ignore
import os
import sys

# ✅ Database Connection
DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    print("❌ ERROR: DATABASE_URL is not set. Exiting.")
    sys.exit(1)

try:
    engine = create_engine(DB_URL)
except Exception as e:
    print(f"❌ ERROR: Could not connect to the database: {e}")
    sys.exit(1)

# ✅ Parse CLI Arguments
parser = argparse.ArgumentParser()
parser.add_argument("--strategy", type=str, required=True, help="Choose a strategy: trend_following, mean_reversion, breakout, momentum")
args = parser.parse_args()

# ✅ Fetch Market Data with Larger Dataset
def fetch_market_data():
    query = """
    SELECT timestamp, bb_mid, trend 
    FROM "TechnicalIndicators" 
    WHERE timestamp >= NOW() - INTERVAL '6 months'  
    ORDER BY timestamp ASC
    """
    
    try:
        with engine.connect() as connection:
            df = pd.read_sql(query, connection)
    except Exception as e:
        print(f"❌ ERROR: Could not fetch data from the database: {e}")
        sys.exit(1)

    # ✅ Ensure Data Exists
    if df.empty:
        print("⚠️ No Data Found! Check database connection & data availability.")
        sys.exit(1)

    print(f"📅 First Timestamp: {df.iloc[0]['timestamp']}")
    print(f"📅 Last Timestamp: {df.iloc[-1]['timestamp']}")
    print(f"🔢 Dataset Size: {len(df)} rows")

    return df

# ✅ Trading Strategies
def apply_strategy(df, strategy):
    balance = 10000  # Starting balance
    position = 0
    trade_history = []
    open_trade_counter = 0  # Track how long a position remains open
    max_trade_size = 1000  # Max position per trade
    last_trade_index = -10  # Ensure first trade is valid

    for i in range(30, len(df) - 1):  # Start from index 30 for proper rolling calculations
        current_price = df.iloc[i]["bb_mid"]
        trend = df.iloc[i]["trend"]
        trade_size = min(balance * 0.05, max_trade_size)  # Trade with 5% capital, capped at max

        # ✅ Trend Following Strategy
        if strategy == "trend_following":
            if trend == "Bullish" and position == 0:
                position = trade_size / current_price  # Buy position
                trade_history.append((df.iloc[i]["timestamp"], "BUY", current_price, np.nan))
            elif trend == "Bearish" and position > 0:
                profit = (current_price * position) - trade_size
                balance += profit  # Update balance
                trade_history.append((df.iloc[i]["timestamp"], "SELL", current_price, profit))
                position = 0

        # ✅ Mean Reversion Strategy
        elif strategy == "mean_reversion":
            mean_price = df["bb_mid"].mean()
            if current_price < mean_price * 0.98 and position == 0:
                position = trade_size / current_price  # Buy position
                trade_history.append((df.iloc[i]["timestamp"], "BUY", current_price, np.nan))
            elif current_price > mean_price * 1.02 and position > 0:
                profit = (current_price * position) - trade_size
                balance += profit  # Update balance
                trade_history.append((df.iloc[i]["timestamp"], "SELL", current_price, profit))
                position = 0
        
        # ✅ Breakout Strategy (Fixed)
        elif strategy == "breakout":
            if i >= 30:  # Ensure at least 30 past candles exist
                rolling_max = df["bb_mid"].rolling(30).max().shift(1).iloc[i]
                rolling_min = df["bb_mid"].rolling(30).min().shift(1).iloc[i]
                threshold = rolling_max  # Just use the rolling max as the threshold
                stop_loss = current_price * 0.99  # 1% below entry
                take_profit = current_price * 1.015  # 1.5% above entry  

                # ✅ Ensure values are valid
                if np.isnan(rolling_max) or np.isnan(rolling_min):
                    continue

                # ✅ Debugging Print
                print(f"🔍 i: {i}, Price: {current_price:.2f}, Max: {rolling_max:.2f}, Min: {rolling_min:.2f}, "
                    f"Threshold: {threshold:.2f}, Stop-loss: {stop_loss:.2f}, TP: {take_profit:.2f}")

                # ✅ Buy Condition (More realistic breakout detection)
                if position == 0 and (current_price > rolling_max) and (i - last_trade_index > 3):
                    print(f"🚀 CONFIRMED BREAKOUT at {current_price:.2f} (Previous Max: {rolling_max:.2f})")
                    position = trade_size / current_price
                    trade_history.append((df.iloc[i]["timestamp"], "BUY", current_price, np.nan))
                    last_trade_index = i
                    open_trade_counter = 0
                    print(f"✅ BUY EXECUTED at {current_price:.2f} (New Position: {position:.6f}, Balance: {balance:.2f})")

                # ✅ Sell Conditions (Take-Profit or Stop-Loss)
                elif position > 0:
                    print(f"🔍 Checking Exit: Price={current_price:.2f} | TP={take_profit:.2f} | SL={stop_loss:.2f} | Position={position:.6f}")

                    if current_price >= take_profit:
                        profit = (current_price * position) - trade_size
                        balance += profit
                        trade_history.append((df.iloc[i]["timestamp"], "SELL", current_price, profit))
                        position = 0
                        print(f"✅ TAKE-PROFIT TRIGGERED at {current_price:.2f} (Profit: {profit:.2f}, New Balance: {balance:.2f})")

                    elif current_price <= stop_loss:
                        profit = (current_price * position) - trade_size
                        balance += profit
                        trade_history.append((df.iloc[i]["timestamp"], "SELL", current_price, profit))
                        position = 0
                        print(f"❌ STOP-LOSS TRIGGERED at {current_price:.2f} (Profit: {profit:.2f}, New Balance: {balance:.2f})")

                    # ✅ Force Exit if Holding Too Long
                    elif open_trade_counter >= 10:
                        profit = (current_price * position) - trade_size
                        balance += profit
                        trade_history.append((df.iloc[i]["timestamp"], "SELL", current_price, profit))
                        position = 0
                        print(f"⚠️ FORCED EXIT at {current_price:.2f} (Profit: {profit:.2f}, New Balance: {balance:.2f})")

                    open_trade_counter += 1  # Increment open position counter

        # ✅ Momentum Strategy
        elif strategy == "momentum":
            momentum_change = df["bb_mid"].pct_change().iloc[i]
            if momentum_change > 0.002 and position == 0:
                position = trade_size / current_price
                trade_history.append((df.iloc[i]["timestamp"], "BUY", current_price, np.nan))
            elif momentum_change < -0.002 and position > 0:
                profit = (current_price * position) - trade_size
                balance += profit
                trade_history.append((df.iloc[i]["timestamp"], "SELL", current_price, profit))
                position = 0

    return balance, trade_history

# ✅ Run Strategy Simulation
df = fetch_market_data()
final_balance, trade_log = apply_strategy(df, args.strategy)

# ✅ Print Performance Metrics
print(f"✅ Strategy: {args.strategy.upper()}")
print(f"💰 Initial Balance: 10000.00")
print(f"💰 Final Balance: {final_balance:.2f}")
print(f"✅ Total Trades Executed: {len(trade_log)}")