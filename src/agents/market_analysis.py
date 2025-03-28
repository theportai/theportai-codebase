class MarketAnalysisAgent:
    def __init__(self):
        pass

    def get_signal(self, data: dict) -> str:
        # Use RSI and MACD logic
        rsi = data.get("rsi", 50)
        macd = data.get("macd", 0)

        if rsi < 30 and macd > 0:
            return 'buy'
        elif rsi > 70 and macd < 0:
            return 'sell'
        else:
            return 'hold'