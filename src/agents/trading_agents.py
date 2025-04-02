import joblib  # type: ignore
import os
import pandas as pd  # type: ignore
import numpy as np  # type: ignore
from datetime import datetime
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('PortAI-Trading')

class PredictionAgent:
    def __init__(self):
        model_path = "src/ml/prediction_model.pkl"
        # Lower threshold to be less conservative
        self.confidence_threshold = 0.6  
        
        if not os.path.exists(model_path):
            logger.warning("prediction_model.pkl not found. Implementing enhanced rule-based logic.")
            self.model = None
            # Track price history for technical indicators
            self.price_history = []
            self.sma_short_period = 5
            self.sma_long_period = 20
            self.last_decision = "hold"
            self.consecutive_signals = 0
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
    
    def calculate_macd(self, prices, fast=12, slow=26, signal=9):
        # Calculate MACD
        ema_fast = pd.Series(prices).ewm(span=fast, min_periods=fast).mean()
        ema_slow = pd.Series(prices).ewm(span=slow, min_periods=slow).mean()
        macd = ema_fast - ema_slow
        signal_line = macd.ewm(span=signal, min_periods=signal).mean()
        return macd.iloc[-1], signal_line.iloc[-1]

    def analyze(self, features_row):
        decision = "hold"
        confidence = 0.0
        
        if self.model is None:
            if isinstance(features_row, pd.DataFrame):
                if 'close' in features_row.columns:
                    current_price = features_row['close'].iloc[-1]
                else:
                    numeric_cols = features_row.select_dtypes(include=[np.number]).columns
                    if len(numeric_cols) > 0:
                        current_price = features_row[numeric_cols[0]].iloc[-1]
                    else:
                        logger.warning("No usable data for prediction")
                        return "hold"
                
                self.price_history.append(current_price)
                
                # Need sufficient data for indicators
                if len(self.price_history) >= self.sma_long_period:
                    # Calculate Simple Moving Averages
                    sma_short = sum(self.price_history[-self.sma_short_period:]) / self.sma_short_period
                    sma_long = sum(self.price_history[-self.sma_long_period:]) / self.sma_long_period
                    
                    # Calculate RSI if enough data
                    if len(self.price_history) >= 16:
                        rsi = self.calculate_rsi(self.price_history)
                        
                        # Add MACD for additional confirmation
                        if len(self.price_history) >= 26:
                            macd, signal_line = self.calculate_macd(self.price_history)
                            macd_signal = "buy" if macd > signal_line else "sell"
                            
                            # Generate signals based on combined indicators
                            if sma_short > sma_long and rsi < 70:  # Golden cross with RSI not overbought
                                confidence = min(1.0, 0.5 + (70 - rsi) / 100 + (sma_short/sma_long - 1))
                                decision = "buy" if macd_signal == "buy" else "hold"
                            elif sma_short < sma_long and rsi > 30:  # Death cross with RSI not oversold
                                confidence = min(1.0, 0.5 + (rsi - 30) / 100 + (1 - sma_short/sma_long))
                                decision = "sell" if macd_signal == "sell" else "hold"
                            
                            # Require consecutive signals for stronger confirmation
                            if decision == self.last_decision and decision != "hold":
                                self.consecutive_signals += 1
                                if self.consecutive_signals >= 2:  # Require at least 2 consecutive signals
                                    confidence += 0.1 * min(self.consecutive_signals, 3)  # Max bonus of 0.3
                            else:
                                self.consecutive_signals = 0
                                
                            self.last_decision = decision
            
            # Save confidence value for logging but only return the decision
            # to maintain compatibility with existing code
            logger.info(f"Prediction confidence: {confidence:.2f}")
            return decision

        try:
            # Get prediction probabilities if available
            if hasattr(self.model, 'predict_proba'):
                proba = self.model.predict_proba(features_row)
                buy_prob = proba[0][1]
                sell_prob = proba[0][0]
                
                # If probability of buy is high enough
                if buy_prob > self.confidence_threshold:
                    logger.info(f"Buy prediction with confidence: {buy_prob:.2f}")
                    return "buy"
                # If probability of sell is high enough
                elif sell_prob > self.confidence_threshold:
                    logger.info(f"Sell prediction with confidence: {sell_prob:.2f}")
                    return "sell"
                else:
                    logger.info(f"Hold prediction (insufficient confidence). Buy: {buy_prob:.2f}, Sell: {sell_prob:.2f}")
                    return "hold"
            else:
                # Standard prediction
                prediction = self.model.predict(features_row)[0]
                if prediction == 1:
                    logger.info("Buy prediction")
                    return "buy"
                elif prediction == -1:
                    logger.info("Sell prediction")
                    return "sell"
                else:
                    logger.info("Hold prediction")
                    return "hold"
        except Exception as e:
            logger.error(f"Model prediction error: {str(e)}")
            
        return "hold"


class SentimentAgent:
    def __init__(self):
        self.price_history = []
        self.volume_history = []
        self.max_history = 10
        # Track the sentiment shift counter - makes agent more responsive
        self.sentiment_shift_counter = 0
        
    def analyze(self, candle):
        try:
            # Update price and volume history
            self.price_history.append(candle["close"])
            self.volume_history.append(candle["volume"])
            
            # Keep history at fixed size
            if len(self.price_history) > self.max_history:
                self.price_history.pop(0)
            if len(self.volume_history) > self.max_history:
                self.volume_history.pop(0)
            
            # Skip non-numeric fields when calculating sum
            numeric_values = [candle[key] for key in ['open', 'high', 'low', 'close', 'volume'] if key in candle]
            
            # Calculate volume ratio safely
            volume_sum = sum(numeric_values) if numeric_values else 1
            volume_ratio = candle["volume"] / volume_sum if volume_sum > 0 else 0
            
            # Calculate price change
            price_change = candle["close"] - candle["open"]
            price_change_pct = (price_change / candle["open"]) * 100 if candle["open"] > 0 else 0
            
            # Calculate volume change if history available
            avg_volume = sum(self.volume_history[:-1]) / len(self.volume_history[:-1]) if len(self.volume_history) > 1 else candle["volume"]
            volume_change = (candle["volume"] - avg_volume) / avg_volume if avg_volume > 0 else 0
            
            # Enhanced sentiment logic
            confidence = 0.0
            
            # Check for trend in price history
            if len(self.price_history) >= 3:
                recent_prices = self.price_history[-3:]
                price_trend = sum(1 for i in range(1, len(recent_prices)) if recent_prices[i] > recent_prices[i-1])
                
                # If we see consistent price increases
                if price_trend >= 2:
                    self.sentiment_shift_counter += 1
                    if self.sentiment_shift_counter >= 2:  # Need consistent positive sentiment
                        confidence = min(0.7, 0.4 + self.sentiment_shift_counter * 0.1)
                        logger.info(f"Sentiment: buy (confidence: {confidence:.2f}, trend detected)")
                        return "buy"
                # If we see consistent price decreases
                elif price_trend == 0:
                    self.sentiment_shift_counter -= 1
                    if self.sentiment_shift_counter <= -2:  # Need consistent negative sentiment
                        confidence = min(0.7, 0.4 + abs(self.sentiment_shift_counter) * 0.1)
                        logger.info(f"Sentiment: sell (confidence: {confidence:.2f}, trend detected)")
                        return "sell"
                else:
                    # Reset counter if no clear trend
                    self.sentiment_shift_counter = 0
            
            # Regular price/volume analysis
            if price_change > 0:
                # Positive price movement
                if volume_ratio > 0.2 and volume_change > 0.1:
                    confidence = min(0.9, 0.5 + abs(price_change_pct) / 10 + volume_change / 2)
                    logger.info(f"Sentiment: buy (confidence: {confidence:.2f})")
                    return "buy"
                elif volume_ratio > 0.1:
                    confidence = min(0.7, 0.4 + abs(price_change_pct) / 20)
                    logger.info(f"Sentiment: buy (confidence: {confidence:.2f})")
                    return "buy"
            elif price_change < 0:
                # Negative price movement
                if volume_ratio > 0.2 and volume_change > 0.1:
                    confidence = min(0.9, 0.5 + abs(price_change_pct) / 10 + volume_change / 2)
                    logger.info(f"Sentiment: sell (confidence: {confidence:.2f})")
                    return "sell"
                elif volume_ratio > 0.1:
                    confidence = min(0.7, 0.4 + abs(price_change_pct) / 20)
                    logger.info(f"Sentiment: sell (confidence: {confidence:.2f})")
                    return "sell"
            
            logger.info(f"Sentiment: hold (confidence: 0.3)")
            return "hold"  # Low confidence hold
            
        except Exception as e:
            logger.error(f"SentimentAgent analyze error: {str(e)}")
            return "hold"  # Safe default with zero confidence


class MarketAnalysisAgent:
    def __init__(self):
        self.price_history = []
        self.volume_history = []
        self.history_size = 20
        self.last_signal = "hold"
        self.signal_cooldown = 0  # Prevent rapid signal flipping
        self.trend_strength = 0  # Track trend strength
        self.consecutive_buy_signals = 0
        self.consecutive_sell_signals = 0
        
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
        
        # Aggressive volume and volatility thresholds
        volume_ratio = current_volume / avg_volume if avg_volume > 0 else 1
        
        # Candlestick pattern analysis
        body_size = abs(candle["close"] - candle["open"])
        body_to_range_ratio = body_size / high_low_range if high_low_range > 0 else 0
        
        # Calculate trend using recent price data
        if len(self.price_history) >= 3:
            short_term_trend = self.price_history[-1] > self.price_history[-3]
            # Increase or decrease trend strength based on price movement
            if short_term_trend and candle["close"] > candle["open"]:
                self.trend_strength = min(5, self.trend_strength + 1)
            elif not short_term_trend and candle["close"] < candle["open"]:
                self.trend_strength = max(-5, self.trend_strength - 1)
            else:
                # Weaken the trend if price moves against it
                self.trend_strength = self.trend_strength * 0.8
        
        # Generate trading signal based on combined factors
        signal = "hold"
        confidence = 0.0
        
        # Volume spike with price increase suggests buying pressure
        if volume_ratio > 1.3 and candle["close"] > candle["open"] and body_to_range_ratio > 0.6:
            signal = "buy"
            confidence = min(0.9, 0.5 + (volume_ratio - 1) / 2 + body_to_range_ratio / 2)
            self.consecutive_buy_signals += 1
            self.consecutive_sell_signals = 0
        # Volume spike with price decrease suggests selling pressure
        elif volume_ratio > 1.3 and candle["close"] < candle["open"] and body_to_range_ratio > 0.6:
            signal = "sell"
            confidence = min(0.9, 0.5 + (volume_ratio - 1) / 2 + body_to_range_ratio / 2)
            self.consecutive_sell_signals += 1
            self.consecutive_buy_signals = 0
        # High volatility with increasing price
        elif price_range_percent > 0.8 and candle["close"] > candle["open"]:
            signal = "buy"
            confidence = min(0.8, 0.4 + price_range_percent / 10)
            self.consecutive_buy_signals += 1
            self.consecutive_sell_signals = 0
        # High volatility with decreasing price
        elif price_range_percent > 0.8 and candle["close"] < candle["open"]:
            signal = "sell"
            confidence = min(0.8, 0.4 + price_range_percent / 10)
            self.consecutive_sell_signals += 1
            self.consecutive_buy_signals = 0
        # Factor in trend strength
        elif self.trend_strength >= 2:  # Reduced from 3 to 2 to be more responsive
            signal = "buy"
            confidence = min(0.7, 0.3 + self.trend_strength / 10)
            self.consecutive_buy_signals += 1
            self.consecutive_sell_signals = 0
        elif self.trend_strength <= -2:  # Reduced from -3 to -2 to be more responsive
            signal = "sell"
            confidence = min(0.7, 0.3 + abs(self.trend_strength) / 10)
            self.consecutive_sell_signals += 1
            self.consecutive_buy_signals = 0
        else:
            # Reset counters if we're holding
            self.consecutive_buy_signals = 0
            self.consecutive_sell_signals = 0
            
        # Boost confidence if we have consecutive signals
        if signal == "buy" and self.consecutive_buy_signals > 1:
            confidence = min(0.95, confidence + 0.05 * min(5, self.consecutive_buy_signals))
        elif signal == "sell" and self.consecutive_sell_signals > 1:
            confidence = min(0.95, confidence + 0.05 * min(5, self.consecutive_sell_signals))
            
        # Only change signal if cooldown is inactive
        if self.signal_cooldown == 0 and signal != "hold":
            self.last_signal = signal
            self.signal_cooldown = 1  # Reduced to 1 to be more responsive
            logger.info(f"Market analysis: {signal} (confidence: {confidence:.2f})")
            return signal
            
        # Return last signal during cooldown with reduced confidence
        if self.signal_cooldown > 0:
            reduced_confidence = max(0.3, confidence - 0.1 * self.signal_cooldown)  # Less reduction
            logger.info(f"Market analysis: {self.last_signal} (confidence: {reduced_confidence:.2f}, cooldown: {self.signal_cooldown})")
            return self.last_signal
            
        logger.info(f"Market analysis: {signal} (confidence: {confidence:.2f})")
        return signal


class DecisionMaker:
    def __init__(self, quorum=2):
        self.quorum = quorum
        self.weights = {
            "market_analysis": 3,  # Increased from 2 to 3 - market analysis gets triple weight
            "sentiment": 1,
            "prediction": 2
        }
        # Track historical decisions for consistency
        self.last_decision = "hold"
        self.decision_count = 0
        self.min_confidence_threshold = 0.4  # Reduced from 0.5 to 0.4
        self.buy_threshold = 0.35  # Lowered threshold for buy action
        self.sell_threshold = 0.35  # Lowered threshold for sell action
        self.hold_requirement = 0.7  # Higher threshold required to force a hold
        
    def decide(self, signals):
        buy_votes = 0
        sell_votes = 0
        hold_votes = 0
        total_weights = sum(self.weights.get(agent, 1) for agent in signals.keys())
        
        # Log agent decisions for debugging
        logger.info("Agent decisions:")
        
        for agent, signal in signals.items():
            weight = self.weights.get(agent, 1)
            logger.info(f"  {agent}: {signal} (weight: {weight})")
            
            if signal == "buy":
                buy_votes += weight
            elif signal == "sell":
                sell_votes += weight
            else:  # hold
                hold_votes += weight
        
        # Calculate the percentage of weights voting for each action
        buy_percentage = buy_votes / total_weights
        sell_percentage = sell_votes / total_weights
        hold_percentage = hold_votes / total_weights
        
        logger.info(f"Vote distribution: buy={buy_percentage:.2f}, sell={sell_percentage:.2f}, hold={hold_percentage:.2f}")
        
        # Decision logic with improved rules
        decision = "hold"
        
        # Only require a strong hold if all agents agree on hold
        if hold_percentage >= self.hold_requirement:
            decision = "hold"
        # Lowered buy threshold
        elif buy_votes >= self.quorum and buy_percentage > self.buy_threshold:
            decision = "buy"
        # Lowered sell threshold
        elif sell_votes >= self.quorum and sell_percentage > self.sell_threshold:
            decision = "sell"
        # Market analysis agent is given more weight for trend following
        elif signals.get("market_analysis") == "buy" and self.last_decision != "sell":
            # If market analysis says buy and we're not already selling, buy
            if buy_percentage >= 0.3:
                decision = "buy"
        elif signals.get("market_analysis") == "sell" and self.last_decision != "buy":
            # If market analysis says sell and we're not already buying, sell
            if sell_percentage >= 0.3:
                decision = "sell"
        # Continue previous decision if not contradicted strongly
        elif self.last_decision == "buy" and buy_percentage > 0.2:
            decision = "buy"  # Continue with buy if still some buy signals
        elif self.last_decision == "sell" and sell_percentage > 0.2:
            decision = "sell"  # Continue with sell if still some sell signals
                
        # Increment counter if same decision, reset if different
        if decision == self.last_decision:
            self.decision_count += 1
        else:
            self.decision_count = 1
            
        self.last_decision = decision
        
        logger.info(f"Final decision: {decision} (consecutive count: {self.decision_count})")
        return decision