from src.agents.trading_agents import DecisionMaker
dm = DecisionMaker()
signals = {
    "market_analysis": "buy",
    "prediction": "buy",
    "sentiment": "buy"
}
decision = dm.decide(signals, symbol="BTCUSDT", current_price=25000)
print("Decision:", decision)