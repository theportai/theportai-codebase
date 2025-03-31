from src.engine.simulation_core import run_simulation_step
from src.engine.plotting import plot_backtest_results

def run_backtest_from_data(ohlcv, market_agent, sentiment_agent, prediction_agent, decision_maker, portfolio, logger):
    print("\n🚀 Running Backtest on OHLCV Data...\n")

    for i, candle in enumerate(ohlcv):
        print(f"\n📅 {candle['timestamp']} | PRICE: {candle['close']}")

        # ✅ Enrich raw OHLCV with mock signals (improved logic)
        price_change = candle['close'] - candle['open']
        rsi = 25 if price_change < -100 else (75 if price_change > 100 else 50)
        macd = 1.5 if price_change > 50 else -1.5 if price_change < -50 else 0
        sentiment_score = 0.6 if price_change > 100 else -0.6 if price_change < -100 else 0
        momentum = 0.5 if price_change > 0 else -0.5

        # ✅ Inject into candle
        candle['rsi'] = rsi
        candle['macd'] = macd
        candle['sentiment_score'] = sentiment_score
        candle['momentum'] = momentum
        candle['price'] = candle['close']

        # ✅ Feed enriched candle to simulation step
        run_simulation_step(
            candle,
            market_agent,
            sentiment_agent,
            prediction_agent,
            decision_maker,
            portfolio
        )

    # ✅ Plot all backtest results (with buy/sell markers)
    plot_backtest_results(ohlcv, logger.trades)