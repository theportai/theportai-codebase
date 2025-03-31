from src.agents.market_analysis import MarketAnalysisAgent
from src.agents.sentiment_agent import SentimentAgent
from src.agents.prediction_agent import PredictionAgent
from src.agents.decision_maker import DecisionMaker
from src.engine.portfolio_state import PortfolioState
from src.engine.trade_logger import TradeLogger
from src.engine.backtest_engine import run_backtest_from_data
from src.data.postgres_ohlcv_loader import get_ohlcv_from_db
from datetime import datetime
from src.utils.enrich_candles import enrich_candle_data


if __name__ == "__main__":
    market_agent = MarketAnalysisAgent()
    sentiment_agent = SentimentAgent()
    prediction_agent = PredictionAgent()
    decision_maker = DecisionMaker(quorum=2)
    logger = TradeLogger()
    portfolio = PortfolioState(starting_balance=10000, logger=logger)


    ohlcv_raw = get_ohlcv_from_db("BTCUSDT", limit=1000)
    ohlcv = enrich_candle_data(ohlcv_raw)


    for candle in ohlcv:
        price = candle["close"]
        date = candle["timestamp"]

        # Run all AI agents
        market_signal = market_agent.analyze(candle)
        sentiment_signal = sentiment_agent.analyze(candle)
        prediction_signal = prediction_agent.analyze(candle)

        signals = {
            "market_analysis": market_signal,
            "sentiment": sentiment_signal,
            "prediction": prediction_signal,
        }

        final_decision = decision_maker.decide(signals)

        timestamp = candle.get("timestamp")
        date = datetime.fromisoformat(timestamp) if isinstance(timestamp, str) else timestamp
        print(f"\n📅 {date.date()} | PRICE: {price}")


        print(f"Signals: {signals} → Final Decision: {final_decision}")

        # Execute decision with guard checks
        if final_decision == "buy" and portfolio.holdings == 0:
            portfolio.buy(price)
        elif final_decision == "sell" and portfolio.holdings > 0:
            portfolio.sell(price)
        else:
            if final_decision == "buy":
                print("❌ BUY aborted: Insufficient balance or already holding.")
            elif final_decision == "sell":
                print("❌ SELL aborted: No BTC holdings.")

        portfolio.status()