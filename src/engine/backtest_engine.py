from src.engine.plotting import plot_backtest_results
from src.engine.simulation_loop import run_simulation_step
from src.data.mock_ohlcv_data import mock_ohlcv
from src.engine.simulation_loop import run_simulation_step, portfolio, logger


def run_backtest_from_data():
    print("\n🚀 Running Backtest on OHLCV Data...\n")

    for candle in mock_ohlcv:
        # Simulate technical indicators and sentiment
        ohlcv_data = {
            'rsi': 28 if candle['close'] < candle['open'] else 75,
            'macd': 1.2 if candle['close'] > candle['open'] else -1.2,
            'sentiment_score': 0.4 if candle['close'] > candle['open'] else -0.4,
            'momentum': 0.6 if candle['close'] > candle['open'] else -0.6,
            'price': candle['close']
        }

        print(f"📅 {candle['timestamp']} | PRICE: {candle['close']}")
        run_simulation_step(ohlcv_data)
    
    plot_backtest_results(mock_ohlcv, logger.trades)