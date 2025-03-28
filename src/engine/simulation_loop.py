from src.agents.market_analysis import MarketAnalysisAgent
from src.agents.sentiment_agent import SentimentAgent
from src.agents.prediction_agent import PredictionAgent
from src.agents.decision_maker import DecisionMaker
from src.engine.trade_executor import TradeExecutor
from src.engine.portfolio_state import PortfolioState
from src.engine.trade_logger import TradeLogger


market_agent = MarketAnalysisAgent()
sentiment_agent = SentimentAgent()
prediction_agent = PredictionAgent()
decision_maker = DecisionMaker(quorum=2)
executor = TradeExecutor()
logger = TradeLogger()
portfolio = PortfolioState(starting_balance=10000, logger=logger)


def run_simulation_step(data):
    signals = {
        'market_analysis': market_agent.get_signal(data),
        'sentiment': sentiment_agent.get_signal(data),
        'prediction': prediction_agent.get_signal(data)
    }

    decision = decision_maker.decide(signals)

    print(f"Signals: {signals} → Final Decision: {decision}")
    
    if decision == 'buy':
        portfolio.buy(data['price'])

    elif decision == 'sell':
        portfolio.sell(data['price'])
    
    portfolio.status()

    return decision



if __name__ == "__main__":

    from src.engine.backtest_engine import run_backtest_from_data
    run_backtest_from_data()
