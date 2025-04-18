class DecisionMaker:
    def __init__(self, quorum=2):
        self.quorum = quorum
        # Agent weights - give more weight to certain agents
        self.weights = {
            "market_analysis": 2,  # Market analysis gets double weight
            "sentiment": 1,
            "prediction": 3       # Prediction agent gets triple weight (if ML model)
        }
        
    def decide(self, signals):
        # Count votes weighted by agent importance
        buy_votes = 0
        sell_votes = 0
        
        for agent, signal in signals.items():
            weight = self.weights.get(agent, 1)
            if signal == "buy":
                buy_votes += weight
            elif signal == "sell":
                sell_votes += weight
                
        # Decision based on weighted votes
        if buy_votes >= self.quorum and buy_votes > sell_votes:
            return "buy"
        elif sell_votes >= self.quorum and sell_votes > buy_votes:
            return "sell"
        
        # Use strongest signal if no consensus
        if max(buy_votes, sell_votes) > 0:
            return "buy" if buy_votes > sell_votes else "sell" if sell_votes > buy_votes else "hold"
            
        return "hold"