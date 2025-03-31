import asyncio
import json
import websockets # type: ignore
from datetime import datetime
#import sys
#import os

from src.agents.market_analysis import MarketAnalysisAgent
from src.agents.sentiment_agent import SentimentAgent
from src.agents.prediction_agent import PredictionAgent
from src.agents.decision_maker import DecisionMaker
from src.engine.portfolio_state import PortfolioState
from src.engine.trade_logger import TradeLogger

#sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

# Binance 1m Kline WebSocket URL
BINANCE_WS_URL = "wss://stream.binance.com:9443/ws/btcusdt@kline_1m"

# Setup Agents
market_agent = MarketAnalysisAgent()
sentiment_agent = SentimentAgent()
prediction_agent = PredictionAgent()
decision_maker = DecisionMaker(quorum=2)

# Portfolio and Logger
logger = TradeLogger()
portfolio = PortfolioState(starting_balance=10000, logger=logger)


def enrich_live_candle(kline):
    return {
        "timestamp": datetime.fromtimestamp(int(kline["t"]) / 1000),
        "open": float(kline["o"]),
        "high": float(kline["h"]),
        "low": float(kline["l"]),
        "close": float(kline["c"]),
        "volume": float(kline["v"])
    }


async def handle_kline_message(candle):
    price = candle["close"]
    timestamp = candle["timestamp"]

    # Run Agents
    market_signal = market_agent.analyze(candle)
    sentiment_signal = sentiment_agent.analyze(candle)
    prediction_signal = prediction_agent.analyze(candle)

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

            if "k" in data and data["k"]["x"]:  # x=True means candle closed
                kline = data["k"]
                candle = enrich_live_candle(kline)
                await handle_kline_message(candle)


if __name__ == "__main__":
    print("🚀 Starting Live Trading Simulation...")
    asyncio.run(run_live_simulation())