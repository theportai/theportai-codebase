import joblib # type: ignore
import os
import pandas as pd # type: ignore
import numpy as np # type: ignore
from datetime import datetime

class PredictionAgent:
    def __init__(self):
        model_path = "src/ml/prediction_model.pkl"
        if not os.path.exists(model_path):
            print("❌ prediction_model.pkl not found. Implementing enhanced rule-based logic.")
            self.model = None
            # Track price history for technical indicators
            self.price_history = []
            self.sma_short_period = 5
            self.sma_long_period = 20
        else:
            self.model = joblib.load(model_path)
            
    def calculate_rsi(self, prices, period=14):
        # Calculate RSI indicator
        deltas = np.diff(prices)
        seed = deltas[:period+1]
        up = seed[seed >= 0].sum()/period
        down = -seed[seed < 0].sum()/period
        if down == 0:
            return 100
        rs = up/down
        return 100 - (100/(1+rs))

    def analyze(self, features_row):
        if self.model is None:
            # If no model exists, use enhanced technical analysis
            if isinstance(features_row, pd.DataFrame):
                # Try to extract price from features if available
                if 'close' in features_row.columns:
                    current_price = features_row['close'].iloc[-1]
                else:
                    # Use first numeric column as proxy for price
                    numeric_cols = features_row.select_dtypes(include=[np.number]).columns
                    if len(numeric_cols) > 0:
                        current_price = features_row[numeric_cols[0]].iloc[-1]
                    else:
                        return "hold"  # No usable data
                
                # Add current price to history
                self.price_history.append(current_price)
                
                # Need enough history for indicators
                if len(self.price_history) >= self.sma_long_period:
                    # Calculate Simple Moving Averages
                    sma_short = sum(self.price_history[-self.sma_short_period:]) / self.sma_short_period
                    sma_long = sum(self.price_history[-self.sma_long_period:]) / self.sma_long_period
                    
                    # Calculate RSI if enough data
                    if len(self.price_history) >= 16:  # Need at least period+2 points
                        rsi = self.calculate_rsi(self.price_history)
                        
                        # Generate signals based on combined indicators
                        if sma_short > sma_long and rsi < 70:  # Golden cross with RSI not overbought
                            return "buy"
                        elif sma_short < sma_long and rsi > 30:  # Death cross with RSI not oversold
                            return "sell"
            
            return "hold"  # Default if no condition met or insufficient data

        # If a model exists, use it with enhanced confidence thresholds
        try:
            # Get prediction probabilities if available
            if hasattr(self.model, 'predict_proba'):
                proba = self.model.predict_proba(features_row)
                # If probability of buy is high enough
                if proba[0][1] > 0.6:  # If buy probability > 60%
                    return "buy"
                # If probability of sell is high enough
                elif proba[0][0] > 0.6:  # If sell probability > 60%
                    return "sell"
            else:
                # Standard prediction
                prediction = self.model.predict(features_row)[0]
                if prediction == 1:
                    return "buy"
                elif prediction == -1:
                    return "sell"
        except Exception as e:
            print(f"⚠️ Model prediction error: {str(e)}")
            
        return "hold"

class SentimentAgent:
    def analyze(self, candle):
        try:
            # Skip non-numeric fields when calculating sum
            numeric_values = [candle[key] for key in ['open', 'high', 'low', 'close', 'volume'] if key in candle]
            
            # Calculate volume ratio safely
            volume_sum = sum(numeric_values) if numeric_values else 1
            volume_ratio = candle["volume"] / volume_sum if volume_sum > 0 else 0
            
            # Simple sentiment logic
            price_change = candle["close"] - candle["open"]
            
            if price_change > 0 and volume_ratio > 0.2:
                return "buy"
            elif price_change < 0 and volume_ratio > 0.2:
                return "sell"
            else:
                return "hold"
        except Exception as e:
            print(f"⚠️ SentimentAgent analyze error: {str(e)}")
            return "hold"  # Safe default

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

# Improved DecisionMaker that weights agent signals and uses majority voting
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