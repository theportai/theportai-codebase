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