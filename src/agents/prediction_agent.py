class PredictionAgent:
    def __init__(self):
        pass

    def analyze(self, candle):
        momentum = candle.get('momentum', 0)

        if momentum > 0.4:
            return 'buy'
        elif momentum < -0.4:
            return 'sell'
        return 'hold'