import asyncio
import json
import websockets  # type: ignore
from datetime import datetime
import hvac # type: ignore
import os
import requests # type: ignore
from src.utils.enhance_trade_logging import TradeLogger  
from src.agents.portfolio_manager import PortfolioManager  
from src.agents.trading_agents import MarketAnalysisAgent, SentimentAgent, PredictionAgent, DecisionMaker # type: ignore
from src.engine.portfolio_report import PortfolioReporter
from src.engine.asset_manager import Asset
from src.ml.feature_engineering import generate_features_labels
from src.core.vault import Vault
from fastapi import FastAPI # type: ignore
from src.server.security import IPWhitelistMiddleware # type: ignore
from fastapi import FastAPI, HTTPException # type: ignore
from src.core.token_manager import TokenManager
from pydantic import BaseModel # type: ignore
from src.utils.audit_logger import log_event


app = FastAPI()
token_manager = TokenManager()

live_mode = True


@app.get("/health")
async def health_check():
    print("✅ Health check passed")
    return {"status": "ok"}

class TokenRequest(BaseModel):
    agent_name: str

@app.post("/generate-token")
def generate_token(request: TokenRequest):
    result = token_manager.generate_token(request.agent_name)
    
    # Handle the case where generate_token returns more than 2 values
    if isinstance(result, tuple) and len(result) >= 2:
        token = result[0]
        expires_at = result[1]
    else:
        # If it returns a single value (like a dictionary or token string)
        token = result
        # Create a default expiration time if needed
        expires_at = datetime.now()

    log_event("token_generated", f"Token generated for {request.agent_name}", agent=request.agent_name)
    
    return {
        "token": token,
        "agent": request.agent_name,
        "expires_at": expires_at.isoformat()
    }

# Add middleware for IP filtering
app.add_middleware(IPWhitelistMiddleware)

# Initialize Vault client
client = hvac.Client(url=os.getenv("VAULT_ADDR"))
client.token = os.getenv("VAULT_TOKEN")

vault = Vault()
BINANCE_API_KEY = vault.get_key("BINANCE_API_KEY", caller="start_live")
BINANCE_SECRET = vault.get_key("BINANCE_SECRET", caller="start_live")




# ✅ WebSocket streams for multiple assets
BINANCE_STREAMS = [
    "btcusdt@kline_1m",
    "ethusdt@kline_1m",
]

BINANCE_WS_URL = "wss://stream.binance.com:9443/stream?streams=btcusdt@kline_1m/ethusdt@kline_1m"

live_buffers = {
    "btcusdt": [],
    "ethusdt": [],
}

# ✅ Setup agents with improved implementations
market_agent = MarketAnalysisAgent()
sentiment_agent = SentimentAgent()
prediction_agent = PredictionAgent()


asset_dict = {
    "btcusdt": Asset("btcusdt", "BTC", "USDT", starting_balance=10000),
    "ethusdt": Asset("ethusdt", "ETH", "USDT", starting_balance=10000),
}


for symbol, asset in asset_dict.items():
    asset.trade_count = 0
    asset.win_count = 0


# ✅ Asset accuracy tracking - using a simple dictionary structure
asset_accuracy = {
    "btcusdt": {"correct_predictions": 0, "total_predictions": 0},
    "ethusdt": {"correct_predictions": 0, "total_predictions": 0},
}

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
                trades = getattr(asset, 'trade_count', 0)  # Safely get trade count
                
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
                total_wins += getattr(asset, 'win_count', 0)  # Safely get win count
            
            # Print portfolio summary
            print(f"🧑‍💼 Portfolio Summary:")
            print(f"Total Balance: ${total_balance:.2f}")
            print(f"Total PnL: ${total_pnl:.2f}")
            print(f"Total Trades: {total_trades}")
            print(f"Total Wins: {total_wins}")
        except Exception as e:
            print(f"⚠️ Error in generate_report: {str(e)}")

portfolio_reporter = SafePortfolioReporter(asset_dict, asset_accuracy)

exposure = {
    "BTCUSDT": 0.001,  # ~7-10 USD
    "ETHUSDT": 0.01   # ~15-20 USD 
}


trade_logger = TradeLogger()
decision_maker = DecisionMaker(quorum=1, trade_logger=trade_logger)


decision_maker.risk_manager.exposure_limits = {
    "BTCUSDT": {"capital": 50, "min_qty": 0.0005},
    "ETHUSDT": {"capital": 50, "min_qty": 0.005}
}

portfolio_manager = PortfolioManager(asset_dict, asset_accuracy, "logs/snapshots")

decision_maker.risk_manager.integrate_with_decision_maker(decision_maker)

BASE_URL = "https://api.binance.com/api/v3"

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
    return BINANCE_API_KEY

def get_binance_secret_key():
    return BINANCE_SECRET

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
    global live_buffers, asset_accuracy  

    price = candle["close"]

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
            
            # Use the updated PredictionAgent.predict() method
            predicted_label, confidence = prediction_agent.predict(last_features)
            prediction_signal = predicted_label
            
            # Log the model confidence
            print(f"[PredictionAgent] Signal: {predicted_label}, Confidence: {confidence:.2f}")
        except Exception as e:
            print(f"⚠️ [{symbol}] ML inference failed:", str(e))
            prediction_signal = "hold"
            confidence = 0.0
    else:
        prediction_signal = "hold"
        confidence = 0.0

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
    
    # Debug logs for confidence levels
    print(f"Signals: {signals} → Final Decision: {final_decision}")
    print(f"Model Confidence: {confidence:.2f}")
    
    # Log more detailed decision information
    if confidence > 0.8:
        print(f"⚡ HIGH CONFIDENCE SIGNAL: {prediction_signal} with {confidence:.2f}")
    
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
    last_price = getattr(asset, 'last_price', None)
    

    if final_decision == "buy" and asset.holdings == 0:
        qty = portfolio_manager.calculate_quantity(symbol, price)
        portfolio_manager.buy(symbol, price, qty)
        asset.trade_count = getattr(asset, 'trade_count', 0) + 1
        asset.last_price = price
        print(f"🔵 BUY EXECUTED at ${price} with confidence {confidence:.2f}")

    elif final_decision == "sell" and asset.holdings > 0:
        portfolio_manager.update_price(symbol.upper(), price)
        portfolio_manager.sell(symbol.upper(), price, correct=(price > last_price))
        asset.trade_count = getattr(asset, 'trade_count', 0) + 1
        if last_price and price > last_price:
            asset.win_count = getattr(asset, 'win_count', 0) + 1
        qty = getattr(asset, "quantity", 0.01)
        print(f"🔴 SELL EXECUTED at ${price} with confidence {confidence:.2f}")
        
    else:
        print("🛑🛑🛑🛑🛑✋✋✋⏸️⏸️PortAI is Holding Now  - No action is taken ⏸️⏸️⏸️✋✋✋🛑🛑🛑🛑🛑")



    asset.status()

    # Get trade count safely
    trade_count = getattr(asset, 'trade_count', 0)

    # ✅ Real-time Trade Logging CSV
    trade_logger.log_trade(
        symbol=symbol.upper(),
        action=final_decision,
        price=price,
        confidence=confidence,
        correct=(actual_trend == predicted_trend),
        total_trades=trade_count,
        accuracy=accuracy_percentage,
    )

    # ✅ Save live portfolio snapshot every 5 trades
    if trade_count > 0 and trade_count % 5 == 0:
        snapshot_path = portfolio_manager.save_portfolio_snapshot()
        print(f"📁 Saved snapshot to: {snapshot_path}")

    try:
        # Generate the portfolio report
        portfolio_reporter.generate_report()
    except Exception as e:
        print(f"⚠️ Error generating report: {str(e)}")
        print(f"⚠️ Error in handle_kline_message: {str(e)}")
        import traceback
        print(traceback.format_exc())

async def run_live_simulation():
    asyncio.create_task(snapshot_task())
    while True:
        try:
            async with websockets.connect(BINANCE_WS_URL) as websocket:
                print("✅ Connect to Binance Live Multi-Asset Mainnet...")
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
                                #print("DEBUG: About to enrich candle")
                                candle = enrich_candle(kline)
                                #print("DEBUG: Candle enriched successfully")
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


async def snapshot_task(interval_sec=300):  # every 5 minutes
    while True:
        try:
            portfolio_manager.save_snapshot()
            print("📸 Portfolio snapshot saved.")
        except Exception as e:
            print(f"⚠️ Error saving snapshot: {str(e)}")
        await asyncio.sleep(interval_sec)


if __name__ == "__main__":
    print("🚀 Starting Live Multi-Asset Execution on Mainnet...")
    asyncio.run(run_live_simulation())