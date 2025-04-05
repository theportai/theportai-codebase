class SentimentAgent:
    def __init__(self):
        # Track recent price movements to detect trends
        self.price_history = []
        self.max_history = 10
        
    def analyze(self, candle):
        # Add current price to history
        self.price_history.append(candle["close"])
        if len(self.price_history) > self.max_history:
            self.price_history.pop(0)  # Remove oldest price
            
        # Calculate immediate price change (more sensitive)
        price_change = (candle["close"] - candle["open"]) / candle["open"]
        
        # Calculate volume-based indication
        volume_ratio = candle["volume"] / sum(candle.values()) if sum(candle.values()) > 0 else 0
        
        # Trend detection (if we have enough history)
        trend_signal = "hold"
        if len(self.price_history) >= 3:
            recent_trend = self.price_history[-1] - self.price_history[-3]
            if recent_trend > 0 and price_change > 0:
                trend_signal = "buy"  # Confirming uptrend
            elif recent_trend < 0 and price_change < 0:
                trend_signal = "sell"  # Confirming downtrend
        
        # Much more sensitive thresholds
        if price_change > 0.001 and volume_ratio > 0.1:  # 0.1% up with significant volume
            return "buy"
        elif price_change < -0.001 and volume_ratio > 0.1:  # 0.1% down with significant volume
            return "sell"
            
        # Return trend-based signal if direct price change doesn't trigger
        return trend_signal
