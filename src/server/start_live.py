import asyncio
import json
import websockets  # type: ignore
from datetime import datetime
import hvac # type: ignore
import os
import requests # type: ignore

# ✅ Agent imports
from src.agents.trading_agents import MarketAnalysisAgent, SentimentAgent, PredictionAgent, DecisionMaker # type: ignore
from src.engine.portfolio_report import PortfolioReporter

# ✅ Portfolio engine
from src.engine.asset_manager import Asset
from src.engine.trade_logger import TradeLogger

# ✅ ML feature generator
from src.ml.feature_engineering import generate_features_labels

# Initialize Vault client
client = hvac.Client(url=os.getenv("VAULT_ADDR"))
client.token = os.getenv("VAULT_TOKEN")

# ✅ WebSocket streams for multiple assets
BINANCE_STREAMS = [
    "btcusdt@kline_1m",
    "ethusdt@kline_1m",
]
BINANCE_WS_URL = "wss://testnet.binance.vision/stream?streams=btcusdt@kline_1m/ethusdt@kline_1m"

live_buffers = {
    "btcusdt": [],
    "ethusdt": [],
}

# ✅ Setup agents with improved implementations
market_agent = MarketAnalysisAgent()
sentiment_agent = SentimentAgent()
prediction_agent = PredictionAgent()
# Use quorum=1 to get more trading signals
decision_maker = DecisionMaker(quorum=1)

# ✅ Initialize assets portfolio
asset_dict = {
    "btcusdt": Asset("btcusdt", "BTC", "USDT", starting_balance=10000),
    "ethusdt": Asset("ethusdt", "ETH", "USDT", starting_balance=10000),
}

# ✅ Asset accuracy tracking - using a simple dictionary structure
asset_accuracy = {
    "btcusdt": {"correct_predictions": 0, "total_predictions": 0},
    "ethusdt": {"correct_predictions": 0, "total_predictions": 0},
}


# Create a custom PortfolioReporter class implementation
# This is a temporary fix to debug the division by zero error
class SafePortfolioReporter:
    def __init__(self, asset_dict, asset_accuracy):
        self.asset_dict = asset_dict
        self.asset_accuracy = asset_accuracy
    
    def generate_report(self):
        try:
            total_balance = 0
            total_pnl = 0
            total_trades = 0
            total_wins = 0
            
            # Process each asset
            for symbol, asset in self.asset_dict.items():
                # Get asset's current value
                current_value = asset.balance
                pnl = 0  # Default PnL
                trades = 0  # Default trades count
                
                # Calculate accuracy percentage safely
                accuracy_percentage = 0
                if symbol in self.asset_accuracy:
                    acc_data = self.asset_accuracy[symbol]
                    if acc_data["total_predictions"] > 0:
                        accuracy_percentage = (acc_data["correct_predictions"] / acc_data["total_predictions"]) * 100
                
                # Print asset info
                print(f"[{symbol}] USD Value: ${current_value:.2f}, PnL: ${pnl:.2f}, Trades: {trades}, Accuracy: {accuracy_percentage:.2f}%")
                
                # Add to totals
                total_balance += current_value
                total_pnl += pnl
                total_trades += trades
            
            # Print portfolio summary
            print(f"🧑‍💼 Portfolio Summary:")
            print(f"Total Balance: ${total_balance:.2f}")
            print(f"Total PnL: ${total_pnl:.2f}")
            print(f"Total Trades: {total_trades}")
            print(f"Total Wins: {total_wins}")
        except Exception as e:
            print(f"⚠️ Error in generate_report: {str(e)}")

# ✅ Use the safe portfolio reporter
portfolio_reporter = SafePortfolioReporter(asset_dict, asset_accuracy)

# ✅ Trade Logger shared across assets
logger = TradeLogger()

BASE_URL = "https://testnet.binance.vision/api/v3"

def place_order(symbol, side, quantity, price):
    url = f"{BASE_URL}/order"
    payload = {
        "symbol": symbol,
        "side": side,
        "type": "LIMIT",
        "timeInForce": "GTC",
        "quantity": quantity,
        "price": price
    }
    response = requests.post(url, data=payload)
    return response.json()

def get_binance_api_key():
    api_key = "G63G6MNAzcR600tF5kzTwTHnZmt1qvMKIsEjSlp9sd6DPBf7HdxNAr4bxDB97pXG"
    print(f"API Key: {api_key}")
    return api_key

def get_binance_secret_key():
    api_secret = "UZ4GbLXTWLQB3ZFrkpQ5eF0YU5CrERJ0WmgYBqKA7uLd46WdIZ0jJ7GPmAix1C"
    return api_secret

def enrich_candle(kline):
    dt_obj = datetime.fromtimestamp(int(kline["t"]) / 1000)
    return {
        "timestamp": dt_obj,  # Keep the datetime object
        "timestamp_str": dt_obj.strftime("%Y-%m-%d %H:%M:%S"),  # Add string version
        "open": float(kline["o"]),
        "high": float(kline["h"]),
        "low": float(kline["l"]),
        "close": float(kline["c"]),
        "volume": float(kline["v"]),
    }



async def handle_kline_message(symbol: str, candle: dict):
    global live_buffers, asset_accuracy  # Ensure these are referenced globally

    price = candle["close"]

    # Debug what keys are actually in the candle
    print(f"DEBUG: Candle keys: {candle.keys()}")


    # Safe access to timestamp, with fallback
    if "timestamp" in candle:
        timestamp = candle["timestamp"]
        timestamp_str = candle.get("timestamp_str", str(timestamp))
    else:
        # Use current time as fallback if timestamp is missing
        print("WARNING: Timestamp missing in candle, using current time")
        timestamp = datetime.now()
        timestamp_str = timestamp.strftime("%Y-%m-%d %H:%M:%S")

    # Update buffer for each asset
    live_buffers[symbol].append(candle)



    # ML-based Prediction Signal
    if len(live_buffers[symbol]) > 30:
        try:
            # Generate features from the latest candles (last 50 for safety)
            X_live, _ = generate_features_labels(live_buffers[symbol][-50:])
            last_features = X_live.iloc[-1:]
            prediction_signal = prediction_agent.analyze(last_features)
        except Exception as e:
            print(f"⚠️ [{symbol}] ML inference failed:", str(e))
            prediction_signal = "hold"
    else:
        prediction_signal = "hold"

    # Run other agent signals (Market, Sentiment)
    market_signal = market_agent.analyze(candle)
    sentiment_signal = sentiment_agent.analyze(candle)

    # Create signals dictionary using strings as keys (hashable)
    signals = {
        "market_analysis": market_signal,
        "sentiment": sentiment_signal,
        "prediction": prediction_signal,
    }

    # Get final decision based on agent signals with improved decision maker
    final_decision = decision_maker.decide(signals)

    print(f"\n🕒 {timestamp_str} | [{symbol.upper()}] PRICE: {price}")
    #print(f"\n🕒 {timestamp} | [{symbol.upper()}] PRICE: {price}")
    #print(f"\n🕒 {candle['timestamp_str']} | [{symbol.upper()}] PRICE: {price}")
    #print(f"\n🕒 {timestamp.strftime('%Y-%m-%d %H:%M:%S')} | [{symbol.upper()}] PRICE: {price}")
    
    
    print(f"Signals: {signals} → Final Decision: {final_decision}")

    # Accuracy Calculation: Compare Actual vs Predicted
    actual_trend = 1 if market_signal == "buy" else -1 if market_signal == "sell" else 0
    predicted_trend = 1 if prediction_signal == "buy" else -1 if prediction_signal == "sell" else 0

    # Calculate accuracy for this asset
    accuracy = 1 if actual_trend == predicted_trend else 0  # 1 for match, 0 for no match

    # Update accuracy data for this asset
    asset_accuracy[symbol]["correct_predictions"] += accuracy
    asset_accuracy[symbol]["total_predictions"] += 1

    # Calculate percentage accuracy for the asset (with safety check)
    accuracy_percentage = 0
    if asset_accuracy[symbol]["total_predictions"] > 0:
        accuracy_percentage = (asset_accuracy[symbol]["correct_predictions"] / 
                             asset_accuracy[symbol]["total_predictions"]) * 100

    # Display the asset's accuracy
    print(f"Accuracy for {symbol.upper()} is: {accuracy_percentage:.2f}%")

    # Execute simulated trade based on decision
    asset = asset_dict[symbol]
    if final_decision == "buy" and asset.holdings == 0:
        asset.buy(price)
    elif final_decision == "sell" and asset.holdings > 0:
        asset.sell(price)
    else:
        print("⚠️ Hold - No action")

    # Update asset status
    asset.status()

    try:
        # Generate the portfolio report
        portfolio_reporter.generate_report()
    except Exception as e:
        print(f"⚠️ Error generating report: {str(e)}")
        print(f"⚠️ Error in handle_kline_message: {str(e)}")
        import traceback
        print(traceback.format_exc())



async def run_live_simulation():
    while True:
        try:
            async with websockets.connect(BINANCE_WS_URL) as websocket:
                print("✅ Connected to Binance Testnet WebSocket...")
                async for message in websocket:
                    try:
                        data = json.loads(message)
                        
                        # Extract the stream and kline data safely
                        if "stream" not in data or "data" not in data or "k" not in data["data"]:
                            print(f"⚠️ Unexpected message format: {data}")
                            continue
                            
                        stream = data["stream"]
                        kline = data["data"]["k"]
                        
                        if kline["x"]:  # candle closed
                            symbol = stream.split("@")[0]
                            try:
                                print("DEBUG: About to enrich candle")
                                candle = enrich_candle(kline)
                                print("DEBUG: Candle enriched successfully")
                                await handle_kline_message(symbol, candle)
                            except Exception as e:
                                print(f"⚠️ Error in candle processing: {str(e)}")
                                import traceback
                                print(traceback.format_exc())  # This will print the full stack trace
                    except Exception as e:
                        print(f"⚠️ Error processing message: {str(e)}")
                        import traceback
                        print(traceback.format_exc())  # This will print the full stack trace
                        
        except websockets.exceptions.ConnectionClosedError as e:
            print(f"⚠️ WebSocket connection closed unexpectedly: {str(e)}")
            print("Reconnecting in 5 seconds...")
            await asyncio.sleep(5)  # Wait 5 seconds before reconnecting
        except Exception as e:
            print(f"⚠️ An error occurred: {str(e)}")
            print(f"Error details: {type(e).__name__}")
            await asyncio.sleep(5)  # Wait 5 seconds before reconnecting

if __name__ == "__main__":
    print("🚀 Starting Live Multi-Asset Simulation on Testnet...")
    asyncio.run(run_live_simulation())