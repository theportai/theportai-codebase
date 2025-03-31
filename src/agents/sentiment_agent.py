class SentimentAgent:
    def __init__(self):
        pass

    def analyze(self, candle):
        sentiment_score = candle.get('sentiment_score', 0)

        if sentiment_score > 0.5:
            return 'buy'
        elif sentiment_score < -0.5:
            return 'sell'
        return 'hold'