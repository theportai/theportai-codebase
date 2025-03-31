class SentimentAgent:
    def analyze(self, candle):
        price_change = (candle["close"] - candle["open"]) / candle["open"]
        if price_change > 0.01:
            return "buy"
        elif price_change < -0.01:
            return "sell"
        return "hold"