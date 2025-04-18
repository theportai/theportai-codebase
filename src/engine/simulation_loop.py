from src.agents.market_analysis import MarketAnalysisAgent
from src.agents.sentiment_agent import SentimentAgent
from src.agents.prediction_agent import PredictionAgent
from src.agents.decision_maker import DecisionMaker
from src.engine.trade_executor import TradeExecutor
from src.engine.portfolio_state import PortfolioState
from src.engine.trade_logger import TradeLogger
from src.engine.simulation_core import run_simulation_step
from src.data.postgres_ohlcv_loader import get_ohlcv_from_db

if __name__ == "__main__":
    market_agent = MarketAnalysisAgent()
    sentiment_agent = SentimentAgent()
    prediction_agent = PredictionAgent()
    decision_maker = DecisionMaker(quorum=2)
    logger = TradeLogger()
    portfolio = PortfolioState(starting_balance=10000, logger=logger)

    ohlcv = get_ohlcv_from_db("BTCUSDT", limit=1000)

    for candle in ohlcv:
        print(f"\n📅 {candle['timestamp']} | PRICE: {candle['close']}")
        candle['price'] = candle['close']
        run_simulation_step(candle, market_agent, sentiment_agent, prediction_agent, decision_maker, portfolio)