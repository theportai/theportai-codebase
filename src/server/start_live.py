import asyncio
import json
import websockets  # type: ignore
from datetime import datetime

# ✅ Agent imports
from src.agents.market_analysis import MarketAnalysisAgent
from src.agents.sentiment_agent import SentimentAgent
from src.agents.prediction_agent import PredictionAgent
from src.agents.decision_maker import DecisionMaker
from src.engine.portfolio_report import PortfolioReporter

# ✅ Portfolio engine
from src.engine.asset_manager import Asset
from src.engine.trade_logger import TradeLogger

# ✅ ML feature generator
from src.ml.feature_engineering import generate_features_labels

# ✅ WebSocket streams for multiple assets
BINANCE_STREAMS = [
    "btcusdt@kline_1m",
    "ethusdt@kline_1m",
]
BINANCE_WS_URL = f"wss://stream.binance.com:9443/stream?streams={'/'.join(BINANCE_STREAMS)}"

# ✅ Setup agents
market_agent = MarketAnalysisAgent()
sentiment_agent = SentimentAgent()
prediction_agent = PredictionAgent()
decision_maker = DecisionMaker(quorum=2)

# ✅ Trade Logger shared across assets
logger = TradeLogger()

# ✅ Initialize assets portfolio
asset_dict = {
    "btcusdt": Asset("btcusdt", "BTC", "USDT", starting_balance=10000),
    "ethusdt": Asset("ethusdt", "ETH", "USDT", starting_balance=10000),
}

# ✅ Portfolio Reporter
portfolio_reporter = PortfolioReporter(asset_dict)

# ✅ Track candle history per asset
live_buffers = {
    "btcusdt": [],
    "ethusdt": [],
}

def enrich_candle(kline):
    return {
        "timestamp": datetime.fromtimestamp(int(kline["t"]) / 1000),
        "open": float(kline["o"]),
        "high": float(kline["h"]),
        "low": float(kline["l"]),
        "close": float(kline["c"]),
        "volume": float(kline["v"]),
    }


asset_accuracy = {}

async def handle_kline_message(symbol: str, candle: dict):
    price = candle["close"]
    timestamp = candle["timestamp"]

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

    signals = {
        "market_analysis": market_signal,
        "sentiment": sentiment_signal,
        "prediction": prediction_signal,
    }

    # Get final decision based on agent signals
    final_decision = decision_maker.decide(signals)

    print(f"\n🕒 {timestamp} | [{symbol.upper()}] PRICE: {price}")
    print(f"Signals: {signals} → Final Decision: {final_decision}")

    # Accuracy Calculation: Compare Actual vs Predicted
    actual_trend = 1 if market_signal == "buy" else -1 if market_signal == "sell" else 0
    predicted_trend = 1 if prediction_signal == "buy" else -1 if prediction_signal == "sell" else 0

    # Calculate accuracy for this asset
    accuracy = 1 if actual_trend == predicted_trend else 0  # 1 for match, 0 for no match

    # Initialize accuracy tracking for the asset if not present
    if symbol not in asset_accuracy:
        asset_accuracy[symbol] = {"correct_predictions": 0, "total_predictions": 0}

    # Update accuracy data for this asset
    asset_accuracy[symbol]["correct_predictions"] += accuracy
    asset_accuracy[symbol]["total_predictions"] += 1

    # Calculate percentage accuracy for the asset
    accuracy_percentage = (asset_accuracy[symbol]["correct_predictions"] / asset_accuracy[symbol]["total_predictions"]) * 100

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

    # Generate the portfolio report (including asset accuracy) after processing both assets
    portfolio_reporter.generate_report()


async def run_live_simulation():
    async with websockets.connect(BINANCE_WS_URL) as websocket:
        print("✅ Connected to Binance WebSocket...")

        async for message in websocket:
            data = json.loads(message)
            stream = data["stream"]
            kline = data["data"]["k"]

            if kline["x"]:  # x=True → candle closed
                symbol = stream.split("@")[0]
                candle = enrich_candle(kline)
                await handle_kline_message(symbol, candle)


if __name__ == "__main__":
    print("🚀 Starting Live Multi-Asset Simulation...")
    asyncio.run(run_live_simulation())