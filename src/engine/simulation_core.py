def run_simulation_step(candle, market_agent, sentiment_agent, prediction_agent, decision_maker, portfolio):
    signals = {
        'market_analysis': market_agent.get_signal(candle),
        'sentiment': sentiment_agent.get_signal(candle),
        'prediction': prediction_agent.get_signal(candle)
    }

    decision = decision_maker.decide(signals)
    print(f"Signals: {signals} → Final Decision: {decision}")

    if decision == 'buy':
        portfolio.buy(candle['price'])
    elif decision == 'sell':
        portfolio.sell(candle['price'])

    portfolio.status()
    return decision