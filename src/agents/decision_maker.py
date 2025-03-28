class DecisionMaker:
    def __init__(self, quorum=2):
        self.quorum = quorum

    def decide(self, signals: dict) -> str:
        count = {'buy': 0, 'sell': 0, 'hold': 0}

        for signal in signals.values():
            count[signal] += 1

        for action in ['buy', 'sell']:
            if count[action] >= self.quorum:
                return action

        return 'hold'