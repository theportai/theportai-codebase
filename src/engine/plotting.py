import matplotlib.pyplot as plt # type: ignore
from matplotlib.dates import date2num # type: ignore
import matplotlib.dates as mdates # type: ignore
from datetime import datetime

def plot_backtest_results(ohlcv_data, trades):
    dates = [datetime.strptime(candle['timestamp'], "%Y-%m-%d") for candle in ohlcv_data]
    prices = [candle['close'] for candle in ohlcv_data]

    # Plot candlestick-style close line
    plt.figure(figsize=(12, 6))
    plt.plot(dates, prices, label='Price', linewidth=2)

    # Plot Buy/Sell markers
    for trade in trades:
        dt = datetime.strptime(trade['timestamp'], "%Y-%m-%d")
        color = 'green' if trade['action'] == 'buy' else 'red'
        plt.scatter(dt, trade['price'], color=color, marker='^' if trade['action'] == 'buy' else 'v', s=100)
        if 'pnl' in trade:
            pnl = round(trade['pnl'], 2)
            plt.text(dt, trade['price'], f"${pnl}", fontsize=8, ha='center', color=color)

    plt.title("PORTAI Backtest: Buy/Sell Points & PnL")
    plt.xlabel("Date")
    plt.ylabel("Price (USDT)")
    plt.legend()
    plt.grid(True)
    plt.tight_layout()
    plt.gcf().autofmt_xdate()
    plt.show()