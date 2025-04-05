import joblib  # type: ignore
import os
import pandas as pd  # type: ignore
import numpy as np  # type: ignore
from datetime import datetime
import logging
from src.utils.enhance_trade_logging import TradeLogger
from .sentiment_fetcher import get_sentiment_scores
from src.agents.risk_manager import RiskManager

# Initialize once
risk_manager = RiskManager({
    "BTCUSDT": 0.001,  # 0.1% of portfolio 
    "ETHUSDT": 0.01,   # 1% of portfolio
    "SOLUSDT": 0.005   # 0.5% of portfolio
})

# Set up logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('PortAI-Trading-Agents')

class PredictionAgent:
    def __init__(self):
        # NEW: Point to latest model path
        MODEL_DIR = "model_artifacts_20250403_004624"
        model_path = os.path.join(MODEL_DIR, "xgboost_model.pkl")
        scaler_path = os.path.join(MODEL_DIR, "feature_scaler.pkl")
        selector_path = os.path.join(MODEL_DIR, "feature_selector.pkl")
        
        # Lower threshold to be less conservative
        self.confidence_threshold = 0.6  
        
        if not os.path.exists(model_path) or not os.path.exists(scaler_path) or not os.path.exists(selector_path):
            logger.warning("Model artifacts not found. Implementing enhanced rule-based logic.")
            self.model = None
            self.scaler = None
            self.selector = None
            # Track price history for technical indicators
            self.price_history = []
            self.sma_short_period = 5
            self.sma_long_period = 20
            self.last_decision = "hold"
            self.consecutive_signals = 0
        else:
            logger.info(f"Loading model from {model_path}")
            self.model = joblib.load(model_path)
            self.scaler = joblib.load(scaler_path)
            self.selector = joblib.load(selector_path)
            
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

    def predict(self, features: dict) -> tuple:
        """
        Make a prediction from a single feature set.
        Returns: (predicted_label, confidence_score)
        """
        if self.model is None or self.scaler is None or self.selector is None:
            return 0, 0.0  # Return hold with zero confidence if models not available
            
        X = pd.DataFrame([features])

        # Apply feature selection
        X_selected = X[self.selector]

        # Scale features
        X_scaled = self.scaler.transform(X_selected)

        # Predict probabilities
        probs = self.model.predict_proba(X_scaled)[0]

        # Custom thresholds
        thresholds = {-1: 0.46767005, 0: 0.118604176, 1: 0.40466714}

        # Decide class based on thresholds
        label_map = {-1: 0, 0: 1, 1: 2}  # xgboost class indices
        predicted = None
        confidence = 0.0

        for label, idx in label_map.items():
            if probs[idx] >= thresholds[label]:
                predicted = label
                confidence = probs[idx]
                break

        # If no label passes threshold, default to hold
        if predicted is None:
            predicted = 0
            confidence = probs[1]

        return predicted, confidence

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
            # Use new prediction method
            features_dict = {}
            
            # Convert DataFrame to dict if needed
            if isinstance(features_row, pd.DataFrame):
                features_dict = features_row.iloc[0].to_dict()
            else:
                features_dict = features_row
                
            predicted_label, confidence = self.predict(features_dict)
            
            if predicted_label == 1:
                if confidence > self.confidence_threshold:
                    logger.info(f"Buy prediction with confidence: {confidence:.2f}")
                    return "buy"
                else:
                    logger.info(f"Hold prediction (insufficient buy confidence): {confidence:.2f}")
                    return "hold"
            elif predicted_label == -1:
                if confidence > self.confidence_threshold:
                    logger.info(f"Sell prediction with confidence: {confidence:.2f}")
                    return "sell"
                else:
                    logger.info(f"Hold prediction (insufficient sell confidence): {confidence:.2f}")
                    return "hold"
            else:
                logger.info(f"Hold prediction with confidence: {confidence:.2f}")
                return "hold"
                
        except Exception as e:
            logger.error(f"Model prediction error: {str(e)}")
            
        return "hold"


class SentimentAgent:
    def __init__(self):
        self.price_history = []
        self.volume_history = []
        self.max_history = 10
        self.sentiment_shift_counter = 0
        self.latest_sentiment_score = 0.0

    def update_sentiment_score(self):
        try:
            scores = get_sentiment_scores()
            self.latest_sentiment_score = scores["final_score"]
        except Exception as e:
            logger.warning(f"Sentiment fetch failed: {e}")
            self.latest_sentiment_score = 0  # fallback

    def analyze(self, candle):
        try:
            # Call the new method to update sentiment score
            self.update_sentiment_score()

            # Step 2: Track price & volume history
            self.price_history.append(candle["close"])
            self.volume_history.append(candle["volume"])

            if len(self.price_history) > self.max_history:
                self.price_history.pop(0)
            if len(self.volume_history) > self.max_history:
                self.volume_history.pop(0)

            # Step 3: Calculate metrics
            price_change = candle["close"] - candle["open"]
            price_change_pct = (price_change / candle["open"]) * 100 if candle["open"] > 0 else 0

            numeric_values = [candle[key] for key in ['open', 'high', 'low', 'close', 'volume'] if key in candle]
            volume_sum = sum(numeric_values) if numeric_values else 1
            volume_ratio = candle["volume"] / volume_sum if volume_sum > 0 else 0

            avg_volume = sum(self.volume_history[:-1]) / len(self.volume_history[:-1]) if len(self.volume_history) > 1 else candle["volume"]
            volume_change = (candle["volume"] - avg_volume) / avg_volume if avg_volume > 0 else 0

            # Step 4: Analyze price trends
            confidence = 0.0
            if len(self.price_history) >= 3:
                recent_prices = self.price_history[-3:]
                trend = sum(1 for i in range(1, len(recent_prices)) if recent_prices[i] > recent_prices[i-1])

                if trend >= 2:
                    self.sentiment_shift_counter += 1
                    if self.sentiment_shift_counter >= 2:
                        confidence = min(0.7, 0.4 + self.sentiment_shift_counter * 0.1)
                        
                        # Log confidence before sentiment boost
                        logger.info(f"Confidence before sentiment boost: {confidence:.2f}")
                        logger.info(f"Sentiment score: {self.latest_sentiment_score:.3f}")
                        
                        # Apply sentiment influence (confidence boosting logic)
                        if self.latest_sentiment_score > 0.3:
                            confidence += 0.1
                        elif self.latest_sentiment_score < -0.3:
                            confidence += 0.1
                        
                        confidence = min(confidence, 1.0)  # keep in 0-1 range
                        
                        # Log final confidence after sentiment boost
                        logger.info(f"Final confidence after sentiment boost: {confidence:.2f}")
                        
                        logger.info(f"Trend: BUY — confidence {confidence:.2f}")
                        return "buy"
                elif trend == 0:
                    self.sentiment_shift_counter -= 1
                    if self.sentiment_shift_counter <= -2:
                        confidence = min(0.7, 0.4 + abs(self.sentiment_shift_counter) * 0.1)
                        
                        # Log confidence before sentiment boost
                        logger.info(f"Confidence before sentiment boost: {confidence:.2f}")
                        logger.info(f"Sentiment score: {self.latest_sentiment_score:.3f}")
                        
                        # Apply sentiment influence (confidence boosting logic)
                        if self.latest_sentiment_score > 0.3:
                            confidence += 0.1
                        elif self.latest_sentiment_score < -0.3:
                            confidence += 0.1
                        
                        confidence = min(confidence, 1.0)  # keep in 0-1 range
                        
                        # Log final confidence after sentiment boost
                        logger.info(f"Final confidence after sentiment boost: {confidence:.2f}")
                        
                        logger.info(f"Trend: SELL — confidence {confidence:.2f}")
                        return "sell"
                else:
                    self.sentiment_shift_counter = 0

            # Step 5: Combine both sources (Price + Sentiment)
            if price_change > 0 and self.latest_sentiment_score > 0.2:
                confidence = min(0.95, 0.5 + abs(self.latest_sentiment_score) + price_change_pct / 20)
                
                # Log confidence for combo sentiment
                logger.info(f"Confidence before sentiment boost: {confidence:.2f}")
                logger.info(f"Sentiment score: {self.latest_sentiment_score:.3f}")
                logger.info(f"Final confidence after sentiment boost: {confidence:.2f}")
                
                logger.info(f"Combo Sentiment: BUY — confidence {confidence:.2f}")
                return "buy"
            elif price_change < 0 and self.latest_sentiment_score < -0.2:
                confidence = min(0.95, 0.5 + abs(self.latest_sentiment_score) + abs(price_change_pct) / 20)
                
                # Log confidence for combo sentiment
                logger.info(f"Confidence before sentiment boost: {confidence:.2f}")
                logger.info(f"Sentiment score: {self.latest_sentiment_score:.3f}")
                logger.info(f"Final confidence after sentiment boost: {confidence:.2f}")
                
                logger.info(f"Combo Sentiment: SELL — confidence {confidence:.2f}")
                return "sell"

            logger.info(f"Sentiment: HOLD — confidence: 0.3")
            return "hold"

        except Exception as e:
            logger.error(f"SentimentAgent analyze error: {str(e)}")
            return "hold"

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
    def __init__(self, quorum=2, trade_logger=None):
        self.quorum = quorum
        self.weights = {
            "market_analysis": 3,
            "sentiment": 1,
            "prediction": 2
        }
        # Track historical decisions for consistency
        self.last_decision = "hold"
        self.decision_count = 0
        self.min_confidence_threshold = 0.4
        self.buy_threshold = 0.35
        self.sell_threshold = 0.35
        self.hold_requirement = 0.7
        
        # Initialize TradeLogger
        self.trade_logger = trade_logger or TradeLogger()
        
        # Add trade statistics tracking
        self.trade_stats = {}
        self.rolling_window_size = 10

        # Initialize risk manager
        self.risk_manager = RiskManager({
            "BTCUSDT": {"capital": 50, "min_qty": 0.0005},
            "ETHUSDT": {"capital": 50, "min_qty": 0.005},
            "SOLUSDT": {"capital": 20, "min_qty": 0.2}
        })
            
    def update_rolling_accuracy(self, symbol, correct):
        """Update rolling accuracy metrics for a symbol"""
        if symbol not in self.trade_stats:
            self.trade_stats[symbol] = {
                "total": 0,
                "correct": 0,
                "accuracy": 0.0,
                "rolling_results": []
            }
            
        # Add current result to rolling window
        self.trade_stats[symbol]["rolling_results"].append(1 if correct else 0)
        
        # Keep only last N results
        if len(self.trade_stats[symbol]["rolling_results"]) > self.rolling_window_size:
            self.trade_stats[symbol]["rolling_results"].pop(0)
            
        # Calculate rolling accuracy
        rolling_acc = sum(self.trade_stats[symbol]["rolling_results"]) / len(self.trade_stats[symbol]["rolling_results"])
        
        return rolling_acc
        
    def decide(self, signals, symbol=None, current_price=None):
        if symbol:
            symbol = symbol.upper()
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
            
        # Calculate confidence based on vote distribution
        final_confidence = 0.0
        if decision == "buy":
            final_confidence = buy_percentage
        elif decision == "sell":
            final_confidence = sell_percentage
        else:
            final_confidence = hold_percentage
            
        # Risk manager integration - check limits before finalizing decision
        if decision in ["buy", "sell"] and symbol:
            # Estimate trade amount based on your system's position sizing
            # This is a placeholder - replace with your actual position sizing logic 
            estimated_trade_amount = 0.001  # Example amount
            
            # Get portfolio value if available, otherwise pass None
            portfolio_value = None  # Replace with actual portfolio value if available
            
            # Check if this trade is within risk limits
            if not self.risk_manager.is_within_limit(symbol, estimated_trade_amount, portfolio_value):
                logger.info(f"Risk manager overriding {decision} to hold due to exposure limits")
                decision = "hold"
            
        # Log trade if a decision to buy or sell is made and we have symbol and price info
        if decision in ["buy", "sell"] and symbol and current_price:
            # You'll need to implement logic to determine if trade was correct
            # For now, we'll assume it's correct (True)
            correct = True
            
            # Update trade stats
            if symbol not in self.trade_stats:
                self.trade_stats[symbol] = {
                    "total": 0,
                    "correct": 0,
                    "accuracy": 0.0,
                    "rolling_results": []
                }
                
            self.trade_stats[symbol]["total"] += 1
            if correct:
                self.trade_stats[symbol]["correct"] += 1
            self.trade_stats[symbol]["accuracy"] = self.trade_stats[symbol]["correct"] / self.trade_stats[symbol]["total"]
            
            # Calculate rolling accuracy
            rolling_acc = self.update_rolling_accuracy(symbol, correct)
            
            # Log the trade
            self.trade_logger.log_trade(
                symbol=symbol,
                action=decision,
                price=current_price,
                confidence=final_confidence,
                correct=correct,
                total_trades=self.trade_stats[symbol]["total"],
                accuracy=self.trade_stats[symbol]["accuracy"],
                rolling_acc=rolling_acc
            )
            
        self.last_decision = decision
        
        logger.info(f"Final decision: {decision} (consecutive count: {self.decision_count})")
        return decision
        
    def execute_trade(self, symbol, amount, action, price):
        """Execute trade and update risk manager exposure"""
        # Your existing trade execution code would go here
        
        # After successful execution, update risk manager
        self.risk_manager.update_exposure(symbol, amount, action, price)
        
        # If you're tracking PnL, update that too
        if hasattr(self, 'portfolio') and hasattr(self.portfolio, 'value'):
            pnl = self.calculate_trade_pnl()  # Replace with your actual PnL calculation
            self.risk_manager.record_pnl(pnl, self.portfolio.value)
            
    def calculate_trade_pnl(self):
        """Placeholder for PnL calculation logic"""
        # Implement your actual PnL calculation here
        return 0.0