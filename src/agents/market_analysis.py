class MarketAnalysisAgent:
    def __init__(self):
        self.price_history = []
        self.volume_history = []
        self.history_size = 20
        self.last_signal = "hold"
        self.signal_cooldown = 0  # Prevent rapid signal flipping
        
    def analyze(self, candle):
        # Update historical data
        self.price_history.append(candle["close"])
        self.volume_history.append(candle["volume"])
        
        # Keep history at fixed size
        if len(self.price_history) > self.history_size:
            self.price_history.pop(0)
        if len(self.volume_history) > self.history_size:
            self.volume_history.pop(0)
            
        # Reduce cooldown if active
        if self.signal_cooldown > 0:
            self.signal_cooldown -= 1
            
        # Get current values
        current_price = candle["close"]
        current_volume = candle["volume"]
        
        # Calculate average volume over available history
        avg_volume = sum(self.volume_history) / len(self.volume_history) if self.volume_history else current_volume
        
        # Calculate volatility
        high_low_range = candle["high"] - candle["low"]
        price_range_percent = (high_low_range / current_price) * 100
        
        # Much more aggressive volume and volatility thresholds
        volume_ratio = current_volume / avg_volume if avg_volume > 0 else 1
        
        # Candlestick pattern analysis
        body_size = abs(candle["close"] - candle["open"])
        body_to_range_ratio = body_size / high_low_range if high_low_range > 0 else 0
        
        # Generate trading signal based on combined factors
        signal = "hold"
        
        # Volume spike with price increase suggests buying pressure
        if volume_ratio > 1.2 and candle["close"] > candle["open"] and body_to_range_ratio > 0.6:
            signal = "buy"
        # Volume spike with price decrease suggests selling pressure
        elif volume_ratio > 1.2 and candle["close"] < candle["open"] and body_to_range_ratio > 0.6:
            signal = "sell"
        # High volatility with increasing price
        elif price_range_percent > 0.5 and candle["close"] > candle["open"]:
            signal = "buy"
        # High volatility with decreasing price
        elif price_range_percent > 0.5 and candle["close"] < candle["open"]:
            signal = "sell"
            
        # Only change signal if cooldown is inactive
        if self.signal_cooldown == 0 and signal != "hold":
            self.last_signal = signal
            self.signal_cooldown = 3  # Set cooldown to prevent signal flipping
            return signal
            
        return self.last_signal if self.signal_cooldown > 0 else signal