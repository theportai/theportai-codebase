class SentimentAgent:
    def __init__(self):
        pass

    def get_signal(self, data: dict) -> str:
        score = data.get("sentiment_score", 0)

        if score > 0.3:
            return 'buy'
        elif score < -0.3:
            return 'sell'
        else:
            return 'hold'