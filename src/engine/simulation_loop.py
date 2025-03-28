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
    buy_data = {
        'rsi': 28,
        'macd': 1.2,
        'sentiment_score': 0.4,
        'momentum': 0.2,
        'price': 63000
    }

    sell_data = {
        'rsi': 75,
        'macd': -1.5,
        'sentiment_score': -0.6,
        'momentum': -0.8,
        'price': 65500
    }

    print("\n🔁 [STEP 1: BUY]")
    run_simulation_step(buy_data)

    print("\n🔁 [STEP 2: SELL]")
    run_simulation_step(sell_data)