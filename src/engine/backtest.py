from src.agents.market_analysis import MarketAnalysisAgent
from src.agents.sentiment_agent import SentimentAgent
from src.agents.prediction_agent import PredictionAgent
from src.agents.decision_maker import DecisionMaker
from src.engine.portfolio_state import PortfolioState
from src.engine.trade_logger import TradeLogger
from src.data.postgres_ohlcv_loader import get_ohlcv_from_db
from src.utils.enrich_candles import generate_trend_comparisons
from src.analysis.trend_vs_actual_plot import plot_trend_comparison
from src.analysis.agent_performance import evaluate_agent_accuracy, plot_agent_accuracy
from datetime import datetime



if __name__ == "__main__":
    # ✅ Initialize AI agents
    market_agent = MarketAnalysisAgent()
    sentiment_agent = SentimentAgent()
    prediction_agent = PredictionAgent()
    decision_maker = DecisionMaker(quorum=2)

    # ✅ Portfolio & Logger
    logger = TradeLogger()
    portfolio = PortfolioState(starting_balance=10000, logger=logger)

    # ✅ Load historical OHLCV data
    ohlcv = get_ohlcv_from_db("BTCUSDT", limit=1000)

    # ✅ Simulate agent decisions
    for candle in ohlcv:
        price = candle["close"]
        date = candle["timestamp"]
        date = datetime.fromisoformat(date) if isinstance(date, str) else date

        # Agent signals
        market_signal = market_agent.analyze(candle)
        sentiment_signal = sentiment_agent.analyze(candle)
        prediction_signal = prediction_agent.analyze(candle)

        signals = {
            "market_analysis": market_signal,
            "sentiment": sentiment_signal,
            "prediction": prediction_signal,
        }

        final_decision = decision_maker.decide(signals)

        candle["market_analysis_signal"] = market_signal
        candle["sentiment_signal"] = sentiment_signal
        candle["prediction_signal"] = prediction_signal
        candle["final_decision"] = final_decision

        print(f"\n📅 {date.date()} | PRICE: {price}")
        print(f"Signals: {signals} → Final Decision: {final_decision}")

        # Trade logic
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

    # ✅ Trend accuracy plot
    trend_data = generate_trend_comparisons(ohlcv)
    plot_trend_comparison(trend_data)

    # ✅ Agent performance evaluation
    agents = {
        "market_analysis": market_agent,
        "sentiment": sentiment_agent,
        "prediction": prediction_agent,
    }

    # Evaluate & Visualize agent performance
    agent_accuracy = evaluate_agent_accuracy(ohlcv)
    plot_agent_accuracy(agent_accuracy)