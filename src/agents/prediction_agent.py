class PredictionAgent:
    def analyze(self, candle):
        momentum = candle.get("momentum", 0)
        if momentum > 0.005:
            return "buy"
        elif momentum < -0.005:
            return "sell"
        return "hold"