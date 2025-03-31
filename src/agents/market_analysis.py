class MarketAnalysisAgent:
    def __init__(self):
        pass

    def analyze(self, candle):
        volume = candle.get('volume', 0)

        if volume > 1000:
            return 'buy'
        elif volume < 500:
            return 'sell'
        return 'hold'