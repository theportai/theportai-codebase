class PredictionAgent:
    def __init__(self):
        pass

    def get_signal(self, data: dict) -> str:
        momentum = data.get("momentum", 0)

        if momentum > 0.5:
            return 'buy'
        elif momentum < -0.5:
            return 'sell'
        else:
            return 'hold'