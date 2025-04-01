import asyncio
import json
import websockets  # type: ignore
from datetime import datetime

# ✅ Agent imports
from src.agents.market_analysis import MarketAnalysisAgent
from src.agents.sentiment_agent import SentimentAgent
from src.agents.prediction_agent import PredictionAgent
from src.agents.decision_maker import DecisionMaker

# ✅ Portfolio & Logger
from src.engine.portfolio_state import PortfolioState
from src.engine.trade_logger import TradeLogger

# ✅ ML Feature generator
from src.ml.feature_engineering import generate_features_labels

# Global live candle buffer
live_candles = []

# WebSocket URL
BINANCE_WS_URL = "wss://stream.binance.com:9443/ws/btcusdt@kline_1m"

# Setup agents
market_agent = MarketAnalysisAgent()
sentiment_agent = SentimentAgent()
prediction_agent = PredictionAgent()
decision_maker = DecisionMaker(quorum=2)

# Setup portfolio
logger = TradeLogger()
portfolio = PortfolioState(starting_balance=10000, logger=logger)


def enrich_live_candle(kline):
    return {
        "timestamp": datetime.fromtimestamp(int(kline["t"]) / 1000),
        "open": float(kline["o"]),
        "high": float(kline["h"]),
        "low": float(kline["l"]),
        "close": float(kline["c"]),
        "volume": float(kline["v"]),
    }


async def handle_kline_message(candle):
    price = candle["close"]
    timestamp = candle["timestamp"]

    # Step 1: Add new candle to live buffer
    live_candles.append(candle)

    # Step 2: Get ML prediction only if enough candles available
    if len(live_candles) > 30:
        try:
            X_live, _ = generate_features_labels(live_candles[-50:])  # take last 50 for features
            last_features = X_live.iloc[-1:]
            prediction_signal = prediction_agent.analyze(last_features)
        except Exception as e:
            print("⚠️ PredictionAgent ML inference failed:", str(e))
            prediction_signal = "hold"
    else:
        prediction_signal = "hold"

    # Run other agents
    market_signal = market_agent.analyze(candle)
    sentiment_signal = sentiment_agent.analyze(candle)

    signals = {
        "market_analysis": market_signal,
        "sentiment": sentiment_signal,
        "prediction": prediction_signal,
    }

    final_decision = decision_maker.decide(signals)

    print(f"\n🕒 {timestamp} | PRICE: {price}")
    print(f"Signals: {signals} → Final Decision: {final_decision}")

    # Execute simulated trades
    if final_decision == "buy" and portfolio.holdings == 0:
        portfolio.buy(price)
    elif final_decision == "sell" and portfolio.holdings > 0:
        portfolio.sell(price)
    else:
        print("⚠️ Hold - No action")

    portfolio.status()


async def run_live_simulation():
    async with websockets.connect(BINANCE_WS_URL) as websocket:
        print("✅ Connected to Binance WebSocket.")

        async for message in websocket:
            data = json.loads(message)

            if "k" in data and data["k"]["x"]:  # x=True = candle closed
                kline = data["k"]
                candle = enrich_live_candle(kline)
                await handle_kline_message(candle)


if __name__ == "__main__":
    print("🚀 Starting Live Trading Simulation...")
    asyncio.run(run_live_simulation())