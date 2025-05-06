import joblib
import os
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging
from typing import Dict, Tuple, List, Optional
import requests
from src.utils.enhance_trade_logging import TradeLogger
from src.agents.risk_manager import RiskManager
from dotenv import load_dotenv
from src.ml.feature_engineering import compute_technical_indicators
import xgboost as xgb

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("logs/trading_agents.log"),
        logging.StreamHandler(),
    ]
)
logger = logging.getLogger('PortAI-Trading-Agents')

# Feature engineering utility functions
def calculate_rsi(prices: pd.Series, period: int = 14) -> pd.Series:
    """Calculate the Relative Strength Index (RSI)."""
    delta = prices.diff()
    gain = delta.where(delta > 0, 0).rolling(window=period).mean()
    loss = -delta.where(delta < 0, 0).rolling(window=period).mean()
    rs = gain / loss
    rs = rs.replace([np.inf, -np.inf], np.nan)  # Handle division by zero
    rsi = 100 - (100 / (1 + rs))
    return rsi

def calculate_macd(prices: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.Series:
    """Calculate the MACD (Moving Average Convergence Divergence)."""
    ema_fast = prices.ewm(span=fast, adjust=False).mean()
    ema_slow = prices.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    return macd_line - signal_line

def calculate_pivot_proximity(df: pd.DataFrame, window: int = 20) -> np.ndarray:
    """Calculate proximity to support/resistance levels."""
    pivot_high = df['high'].rolling(window, center=True).apply(
        lambda x: x[len(x)//2] == max(x), raw=True
    ).fillna(0)
    pivot_low = df['low'].rolling(window, center=True).apply(
        lambda x: x[len(x)//2] == min(x), raw=True
    ).fillna(0)
    proximity = np.zeros(len(df))

    for i in range(len(df)):
        look_back = 100
        start_idx = max(0, i - look_back)
        recent_highs = []
        recent_lows = []

        for j in range(start_idx, i):
            if j < len(pivot_high) and pivot_high.iloc[j] > 0:
                recent_highs.append(df['high'].iloc[j])
            if j < len(pivot_low) and pivot_low.iloc[j] > 0:
                recent_lows.append(df['low'].iloc[j])

        if not recent_highs and not recent_lows:
            continue

        price = df['close'].iloc[i]
        nearest_distance = float('inf')
        for level in recent_highs + recent_lows:
            distance = abs(price - level) / price if price > 0 else float('inf')
            if distance < nearest_distance:
                nearest_distance = distance

        proximity[i] = 1 - min(nearest_distance * 100, 1)

    return proximity

def add_advanced_features(X: pd.DataFrame, df: pd.DataFrame) -> pd.DataFrame:
    """Add comprehensive market-specific features for better prediction."""
    # Ensure X has the same index as df
    X = pd.DataFrame(X)
    X.index = df.index[:len(X)]

    # Market structure features
    X['trend_strength'] = (
        abs(df['close'].rolling(50).mean() - df['close'].rolling(200).mean()) / 
        df['close'].rolling(50).std()
    )

    # Volatility features
    X['atr_14'] = df['high'].rolling(14).max() - df['low'].rolling(14).min()
    X['volatility_14'] = df['close'].rolling(14).std()
    X['volatility_ratio'] = df['close'].rolling(5).std() / df['close'].rolling(20).std()

    # Momentum features
    X['rsi_14'] = calculate_rsi(df['close'], 14)
    X['macd'] = calculate_macd(df['close'])
    X['price_momentum'] = (
        df['close'].pct_change(5) + df['close'].pct_change(10) + df['close'].pct_change(20)
    )

    # Volume features
    X['volume_change'] = df['volume'].pct_change()
    X['volume_ma_ratio'] = df['volume'] / df['volume'].rolling(20).mean()
    X['volume_price_trend'] = (df['close'] - df['close'].shift(1)) * df['volume']
    X['volume_divergence'] = (
        (df['volume'].rolling(5).mean() / df['volume'].rolling(20).mean()) -
        (df['close'].rolling(5).mean() / df['close'].rolling(20).mean())
    )

    # Price action features
    high_low_range = df['high'] - df['low']
    X['body_size'] = abs(df['close'] - df['open']) / high_low_range.replace(0, np.nan)
    X['upper_shadow'] = (
        (df['high'] - df[['open', 'close']].max(axis=1)) / high_low_range.replace(0, np.nan)
    )
    X['lower_shadow'] = (
        (df[['open', 'close']].min(axis=1) - df['low']) / high_low_range.replace(0, np.nan)
    )
    X['close_position'] = (df['close'] - df['low']) / high_low_range.replace(0, np.nan)

    # Market regime features
    X['price_sma_ratio'] = df['close'] / df['close'].rolling(50).mean()
    X['bollinger_position'] = (
        (df['close'] - df['close'].rolling(20).mean()) / (df['close'].rolling(20).std() * 2)
    )
    X['bb_width'] = (
        (df['close'].rolling(20).mean() + 2 * df['close'].rolling(20).std() -
         (df['close'].rolling(20).mean() - 2 * df['close'].rolling(20).std())) /
        df['close'].rolling(20).mean()
    )

    # Support/Resistance proximity indicators
    proximity = calculate_pivot_proximity(df)
    X['pivot_proximity'] = proximity[:len(X)]

    # Trend direction features
    sma_20 = df['close'].rolling(20).mean()
    sma_50 = df['close'].rolling(50).mean()
    sma_200 = df['close'].rolling(200).mean()
    X['sma_20_50_cross'] = (sma_20 > sma_50).astype(int) * 2 - 1
    X['sma_50_200_cross'] = (sma_50 > sma_200).astype(int) * 2 - 1

    # Time-based features
    try:
        df['datetime'] = pd.to_datetime(df.index, errors='coerce', utc=True)
        if not df['datetime'].isna().all():
            X['hour'] = df['datetime'].dt.hour[:len(X)]
            X['day_of_week'] = df['datetime'].dt.dayofweek[:len(X)]
        else:
            raise ValueError("All datetime values are NaN")
    except Exception as e:
        logger.warning(f"Could not extract time features: {str(e)}")
        X['hour'] = 0
        X['day_of_week'] = 0

    # Replace deprecated fillna(method='bfill') with bfill()
    X = X.bfill()
    X = X.fillna(0)

    return X

class PredictionAgent:
    def __init__(self):
        # Use environment variable for model path
        MODEL_DIR = os.getenv("MODEL_DIR", "model_artifacts_20250403_004624")
        self.model_path = os.path.join(MODEL_DIR, "xgboost_model.pkl")
        self.scaler_path = os.path.join(MODEL_DIR, "feature_scaler.pkl")
        self.selector_path = os.path.join(MODEL_DIR, "feature_selector.pkl")
        self.thresholds_path = os.path.join(MODEL_DIR, "optimal_thresholds.txt")
        self.feature_names_path = os.path.join(MODEL_DIR, "feature_names.pkl")  # Save feature names

        self.confidence_threshold = 0.6
        self.candle_history: Dict[str, List[Dict]] = {}  # Symbol-specific candle history
        self.max_history = 200
        self.min_candles_for_features = 200
        self.supported_symbols = {"BTCUSDT", "ETHUSDT"}
        self.feature_names: List[str] = []  # Store feature names from training

        # Load model artifacts
        try:
            if not all(os.path.exists(path) for path in [self.model_path, self.scaler_path, self.selector_path]):
                logger.error("Model artifacts not found. Cannot proceed without ML model.")
                raise FileNotFoundError("Model artifacts not found.")
            
            logger.info(f"Loading model from {self.model_path}")
            self.model = joblib.load(self.model_path)
            self.scaler = joblib.load(self.scaler_path)
            self.selector = joblib.load(self.selector_path)
            
            # Load feature names
            if os.path.exists(self.feature_names_path):
                self.feature_names = joblib.load(self.feature_names_path)
                logger.info(f"Loaded {len(self.feature_names)} feature names: {self.feature_names}")
            else:
                logger.warning("Feature names file not found. You'll need to set feature_names manually or retrain the model.")
                # Fallback: Infer feature names based on add_advanced_features output
                self.feature_names = [
                    'momentum', 'sma_diff', 'rsi', 'macd', 'macd_signal', 'trend_strength',
                    'atr_14', 'volatility_14', 'volatility_ratio', 'rsi_14', 'macd', 'price_momentum',
                    'volume_change', 'volume_ma_ratio', 'volume_price_trend', 'volume_divergence',
                    'body_size', 'upper_shadow', 'lower_shadow', 'close_position', 'price_sma_ratio',
                    'bollinger_position', 'bb_width', 'pivot_proximity', 'sma_20_50_cross',
                    'sma_50_200_cross', 'hour', 'day_of_week'
                ]
                logger.info(f"Using default feature names: {self.feature_names}")
        except Exception as e:
            logger.error(f"Failed to load model artifacts: {str(e)}")
            raise RuntimeError(f"Failed to load model artifacts: {str(e)}")

        # Load optimal thresholds
        self.thresholds = {-1: 0.46767005, 0: 0.118604176, 1: 0.40466714}  # Fallback defaults
        try:
            with open(self.thresholds_path, 'r') as f:
                for line in f:
                    label, thresh = line.strip().split(': ')
                    self.thresholds[int(label)] = float(thresh)
            logger.info(f"Loaded optimal thresholds: {self.thresholds}")
        except Exception as e:
            logger.warning(f"Failed to load optimal thresholds, using defaults: {str(e)}")

    def load_historical_data(self, symbol: str) -> None:
        """Fetch historical 5-minute kline data for the given symbol to pre-populate candle_history."""
        symbol = symbol.upper()
        if symbol not in self.supported_symbols:
            logger.error(f"Unsupported symbol: {symbol}. Supported symbols are: {self.supported_symbols}")
            return

        try:
            if symbol not in self.candle_history:
                self.candle_history[symbol] = []

            end_time = int(datetime.now().timestamp() * 1000)
            start_time = end_time - (self.max_history * 5 * 60 * 1000)  # 200 candles * 5 minutes
            url = f"https://api.binance.com/api/v3/klines?symbol={symbol}&interval=5m&startTime={start_time}&endTime={end_time}&limit={self.max_history}"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            klines = response.json()

            for kline in klines:
                candle = {
                    "timestamp": datetime.fromtimestamp(int(kline[0]) / 1000),
                    "open": float(kline[1]),
                    "high": float(kline[2]),
                    "low": float(kline[3]),
                    "close": float(kline[4]),
                    "volume": float(kline[5]),
                }
                self.candle_history[symbol].append(candle)

            logger.info(f"Loaded {len(self.candle_history[symbol])} historical candles for PredictionAgent (symbol: {symbol})")
        except Exception as e:
            logger.error(f"Failed to load historical data for {symbol}: {str(e)}")
            if hasattr(e, 'response') and e.response is not None:
                logger.error(f"API response: {e.response.text}")

    def compute_features(self, symbol: str) -> Optional[Dict]:
        """Compute features for the given symbol using candle history."""
        if symbol not in self.candle_history or len(self.candle_history[symbol]) < self.min_candles_for_features:
            logger.warning(
                f"Not enough candles ({len(self.candle_history.get(symbol, []))}) to compute features for {symbol}. "
                f"Need {self.min_candles_for_features}."
            )
            return None

        try:
            # Convert candle history to DataFrame
            df = pd.DataFrame(self.candle_history[symbol])
            if df.empty:
                logger.warning(f"Candle history DataFrame is empty for {symbol}.")
                return None

            # Ensure timestamp is in datetime format
            df["timestamp"] = pd.to_datetime(df["timestamp"], errors='coerce', utc=True)
            df.set_index("timestamp", inplace=True)

            # Compute initial technical indicators
            df = compute_technical_indicators(df)

            # Compute advanced features as done during training
            initial_features = ["momentum", "sma_diff", "rsi", "macd", "macd_signal"]
            X = df[initial_features]
            X = add_advanced_features(X, df)

            # Ensure feature consistency with training
            X = X.tail(1)  # Use the most recent row
            if X.empty:
                logger.warning(f"Feature DataFrame is empty after processing for {symbol}.")
                return None

            # Align features with training feature set
            X_dict = X.iloc[-1].to_dict()
            aligned_features = {}
            for feature in self.feature_names:
                aligned_features[feature] = X_dict.get(feature, 0)  # Fill missing features with 0

            return aligned_features
        except Exception as e:
            logger.error(f"Error in compute_features for {symbol}: {str(e)}", exc_info=True)
            return None

    def predict(self, features: Dict) -> Tuple[int, float]:
        """Predict the market movement using the loaded model."""
        try:
            # Convert features to DataFrame with correct feature order
            X = pd.DataFrame([features])[self.feature_names]

            # Apply feature selection
            X_selected = self.selector.transform(X)

            # Scale the features
            X_scaled = self.scaler.transform(X_selected)

            # Predict probabilities using XGBoost DMatrix
            probs = self.model.predict(xgb.DMatrix(X_scaled))[0]

            label_map = {-1: 0, 0: 1, 1: 2}
            predicted = 0  # Default to hold
            confidence = probs[1]  # Default confidence for hold

            # Determine the predicted class based on thresholds
            for label, idx in label_map.items():
                if probs[idx] >= self.thresholds[label]:
                    predicted = label
                    confidence = probs[idx]
                    break

            return predicted, confidence
        except Exception as e:
            logger.error(f"Prediction error: {str(e)}", exc_info=True)
            return 0, 0.0

    def analyze(self, candle: Dict, symbol: str) -> Tuple[str, float]:
        """Analyze a single candle and return a prediction signal."""
        # Validate candle
        required_fields = {"timestamp", "open", "high", "low", "close", "volume"}
        if not isinstance(candle, dict) or not all(field in candle for field in required_fields):
            logger.error(f"Invalid candle data for PredictionAgent (symbol: {symbol}): {candle}")
            return "hold", 0.0

        symbol = symbol.upper()
        if symbol not in self.supported_symbols:
            logger.error(f"Unsupported symbol: {symbol}")
            return "hold", 0.0

        # Convert timestamp if necessary
        if isinstance(candle["timestamp"], (int, float)):
            candle["timestamp"] = datetime.fromtimestamp(candle["timestamp"])

        # Initialize candle history for this symbol
        if symbol not in self.candle_history:
            self.candle_history[symbol] = []

        self.candle_history[symbol].append(candle)
        if len(self.candle_history[symbol]) > self.max_history:
            self.candle_history[symbol] = self.candle_history[symbol][-self.max_history:]

        features = self.compute_features(symbol)
        if features is None:
            logger.info(f"Not enough data for ML prediction for {symbol}. Returning hold.")
            return "hold", 0.0

        predicted, confidence = self.predict(features)

        decision = "hold"
        if predicted == 1:
            decision = "buy"
        elif predicted == -1:
            decision = "sell"

        logger.info(f"PredictionAgent: {decision} (confidence: {confidence:.2f}, symbol: {symbol})")
        return decision, confidence

class SentimentAgent:
    def __init__(self):
        self.price_history: Dict[str, List[float]] = {}
        self.volume_history: Dict[str, List[float]] = {}
        self.max_history: int = 10
        self.sentiment_shift_counter: Dict[str, int] = {}
        self.latest_sentiment_score: Dict[str, float] = {}
        self.sentiment_api_url: str = os.getenv("SENTIMENT_API_URL", "http://mock-sentiment-api.com/analyze")
        self.sentiment_api_key: str = os.getenv("SENTIMENT_API_KEY", "mock-api-key")

    def fetch_real_sentiment_score(self, symbol: str) -> float:
        """Fetch real sentiment score for the given symbol (mock implementation)."""
        try:
            # Mock sentiment API call (replace with real API, e.g., Twitter/X or NewsAPI)
            response = {
                "symbol": symbol,
                "sentiment_score": np.random.uniform(-1, 1)  # Mock sentiment between -1 (negative) and 1 (positive)
            }
            sentiment_score = float(response["sentiment_score"])
            logger.info(f"Fetched sentiment score for {symbol}: {sentiment_score:.3f}")
            return sentiment_score

            # Example with real API (uncomment and configure):
            # payload = {"symbol": symbol, "api_key": self.sentiment_api_key}
            # response = requests.get(self.sentiment_api_url, params=payload, timeout=5)
            # response.raise_for_status()
            # data = response.json()
            # return float(data["sentiment_score"])
        except Exception as e:
            logger.error(f"Failed to fetch sentiment score for {symbol}: {str(e)}")
            return 0.0  # Neutral sentiment on failure

    def update_sentiment_score(self, symbol: str) -> None:
        """Update the latest sentiment score for the symbol."""
        try:
            self.latest_sentiment_score[symbol] = self.fetch_real_sentiment_score(symbol)
        except Exception as e:
            logger.warning(f"Sentiment fetch failed for {symbol}: {str(e)}")
            self.latest_sentiment_score[symbol] = 0.0

    def analyze(self, candle: Dict, symbol: str) -> Tuple[str, float]:
        """Analyze the candle and return a sentiment-based decision."""
        # Validate candle
        required_fields = {"open", "close", "volume"}
        if not isinstance(candle, dict) or not all(field in candle for field in required_fields):
            logger.error(f"Invalid candle data for SentimentAgent (symbol: {symbol}): {candle}")
            return "hold", 0.3

        symbol = symbol.upper()
        try:
            # Initialize data structures for this symbol
            if symbol not in self.price_history:
                self.price_history[symbol] = []
                self.volume_history[symbol] = []
                self.sentiment_shift_counter[symbol] = 0
                self.latest_sentiment_score[symbol] = 0.0

            self.update_sentiment_score(symbol)

            self.price_history[symbol].append(candle["close"])
            self.volume_history[symbol].append(candle["volume"])

            if len(self.price_history[symbol]) > self.max_history:
                self.price_history[symbol].pop(0)
            if len(self.volume_history[symbol]) > self.max_history:
                self.volume_history[symbol].pop(0)

            price_change = candle["close"] - candle["open"]
            price_change_pct = (price_change / candle["open"]) * 100 if candle["open"] > 0 else 0

            avg_volume = (
                sum(self.volume_history[symbol][:-1]) / (len(self.volume_history[symbol]) - 1)
                if len(self.volume_history[symbol]) > 1 else candle["volume"]
            )
            volume_ratio = candle["volume"] / avg_volume if avg_volume > 0 else 1.0

            decision = "hold"
            confidence = 0.3  # Default confidence for hold

            if len(self.price_history[symbol]) >= 3:
                recent_prices = self.price_history[symbol][-3:]
                trend = sum(1 for i in range(1, len(recent_prices)) if recent_prices[i] > recent_prices[i-1])

                if trend >= 2:
                    self.sentiment_shift_counter[symbol] += 1
                    if self.sentiment_shift_counter[symbol] >= 2:
                        confidence = 0.5 + self.sentiment_shift_counter[symbol] * 0.1
                        if self.latest_sentiment_score[symbol] > 0.3:
                            confidence += 0.1
                        elif self.latest_sentiment_score[symbol] < -0.3:
                            confidence -= 0.1
                        confidence = min(confidence, 1.0)
                        decision = "buy"
                elif trend == 0:
                    self.sentiment_shift_counter[symbol] -= 1
                    if self.sentiment_shift_counter[symbol] <= -2:
                        confidence = 0.5 + abs(self.sentiment_shift_counter[symbol]) * 0.1
                        if self.latest_sentiment_score[symbol] > 0.3:
                            confidence -= 0.1
                        elif self.latest_sentiment_score[symbol] < -0.3:
                            confidence += 0.1
                        confidence = min(confidence, 1.0)
                        decision = "sell"
                else:
                    self.sentiment_shift_counter[symbol] = 0

            if price_change > 0 and self.latest_sentiment_score[symbol] > 0.2:
                confidence = min(0.95, 0.5 + abs(self.latest_sentiment_score[symbol]) + price_change_pct / 20)
                decision = "buy"
            elif price_change < 0 and self.latest_sentiment_score[symbol] < -0.2:
                confidence = min(0.95, 0.5 + abs(self.latest_sentiment_score[symbol]) + abs(price_change_pct) / 20)
                decision = "sell"

            logger.info(f"SentimentAgent: {decision} (confidence: {confidence:.2f}, symbol: {symbol})")
            return decision, confidence

        except Exception as e:
            logger.error(f"SentimentAgent analyze error for {symbol}: {str(e)}")
            return "hold", 0.3

class MarketAnalysisAgent:
    def __init__(self):
        self.price_history: Dict[str, List[float]] = {}
        self.volume_history: Dict[str, List[float]] = {}
        self.history_size: int = 20
        self.last_signal: Dict[str, str] = {}
        self.signal_cooldown: Dict[str, int] = {}
        self.trend_strength: Dict[str, float] = {}
        self.consecutive_buy_signals: Dict[str, int] = {}
        self.consecutive_sell_signals: Dict[str, int] = {}

        # Configurable thresholds
        self.volume_ratio_threshold = float(os.getenv("VOLUME_RATIO_THRESHOLD", 1.3))
        self.price_range_threshold = float(os.getenv("PRICE_RANGE_THRESHOLD", 0.8))
        self.trend_strength_threshold = float(os.getenv("TREND_STRENGTH_THRESHOLD", 2))

    def analyze(self, candle: Dict, symbol: str) -> Tuple[str, float]:
        """Analyze the candle and return a market analysis decision."""
        # Validate candle
        required_fields = {"open", "high", "low", "close", "volume"}
        if not isinstance(candle, dict) or not all(field in candle for field in required_fields):
            logger.error(f"Invalid candle data for MarketAnalysisAgent (symbol: {symbol}): {candle}")
            return "hold", 0.3

        symbol = symbol.upper()
        # Initialize data structures for this symbol
        if symbol not in self.price_history:
            self.price_history[symbol] = []
            self.volume_history[symbol] = []
            self.last_signal[symbol] = "hold"
            self.signal_cooldown[symbol] = 0
            self.trend_strength[symbol] = 0
            self.consecutive_buy_signals[symbol] = 0
            self.consecutive_sell_signals[symbol] = 0

        self.price_history[symbol].append(candle["close"])
        self.volume_history[symbol].append(candle["volume"])

        if len(self.price_history[symbol]) > self.history_size:
            self.price_history[symbol].pop(0)
        if len(self.volume_history[symbol]) > self.history_size:
            self.volume_history[symbol].pop(0)

        # Adaptive cooldown based on volatility
        high_low_range = candle["high"] - candle["low"]
        price_range_percent = (high_low_range / candle["close"]) * 100 if candle["close"] > 0 else 0
        cooldown_period = max(1, int(price_range_percent / 2))  # Higher volatility -> longer cooldown

        if self.signal_cooldown[symbol] > 0:
            self.signal_cooldown[symbol] -= 1

        current_price = candle["close"]
        current_volume = candle["volume"]

        avg_volume = (
            sum(self.volume_history[symbol]) / len(self.volume_history[symbol])
            if self.volume_history[symbol] else current_volume
        )

        price_range_percent = (high_low_range / current_price) * 100 if current_price > 0 else 0
        volume_ratio = current_volume / avg_volume if avg_volume > 0 else 1

        body_size = abs(candle["close"] - candle["open"])
        body_to_range_ratio = body_size / high_low_range if high_low_range > 0 else 0

        if len(self.price_history[symbol]) >= 3:
            short_term_trend = self.price_history[symbol][-1] > self.price_history[symbol][-3]
            if short_term_trend and candle["close"] > candle["open"]:
                self.trend_strength[symbol] = min(5, self.trend_strength[symbol] + 1)
            elif not short_term_trend and candle["close"] < candle["open"]:
                self.trend_strength[symbol] = max(-5, self.trend_strength[symbol] - 1)
            else:
                self.trend_strength[symbol] = self.trend_strength[symbol] * 0.8

        decision = "hold"
        confidence = 0.3

        if volume_ratio > self.volume_ratio_threshold and candle["close"] > candle["open"] and body_to_range_ratio > 0.6:
            decision = "buy"
            confidence = min(0.9, 0.5 + (volume_ratio - 1) / 2 + body_to_range_ratio / 2)
            self.consecutive_buy_signals[symbol] += 1
            self.consecutive_sell_signals[symbol] = 0
        elif volume_ratio > self.volume_ratio_threshold and candle["close"] < candle["open"] and body_to_range_ratio > 0.6:
            decision = "sell"
            confidence = min(0.9, 0.5 + (volume_ratio - 1) / 2 + body_to_range_ratio / 2)
            self.consecutive_sell_signals[symbol] += 1
            self.consecutive_buy_signals[symbol] = 0
        elif price_range_percent > self.price_range_threshold and candle["close"] > candle["open"]:
            decision = "buy"
            confidence = min(0.8, 0.4 + price_range_percent / 10)
            self.consecutive_buy_signals[symbol] += 1
            self.consecutive_sell_signals[symbol] = 0
        elif price_range_percent > self.price_range_threshold and candle["close"] < candle["open"]:
            decision = "sell"
            confidence = min(0.8, 0.4 + price_range_percent / 10)
            self.consecutive_sell_signals[symbol] += 1
            self.consecutive_buy_signals[symbol] = 0
        elif self.trend_strength[symbol] >= self.trend_strength_threshold:
            decision = "buy"
            confidence = min(0.7, 0.3 + self.trend_strength[symbol] / 10)
            self.consecutive_buy_signals[symbol] += 1
            self.consecutive_sell_signals[symbol] = 0
        elif self.trend_strength[symbol] <= -self.trend_strength_threshold:
            decision = "sell"
            confidence = min(0.7, 0.3 + abs(self.trend_strength[symbol]) / 10)
            self.consecutive_sell_signals[symbol] += 1
            self.consecutive_buy_signals[symbol] = 0
        else:
            self.consecutive_buy_signals[symbol] = 0
            self.consecutive_sell_signals[symbol] = 0

        if decision == "buy" and self.consecutive_buy_signals[symbol] > 1:
            confidence = min(0.95, confidence + 0.05 * min(5, self.consecutive_buy_signals[symbol]))
        elif decision == "sell" and self.consecutive_sell_signals[symbol] > 1:
            confidence = min(0.95, confidence + 0.05 * min(5, self.consecutive_sell_signals[symbol]))

        if self.signal_cooldown[symbol] == 0 and decision != "hold":
            self.last_signal[symbol] = decision
            self.signal_cooldown[symbol] = cooldown_period
            logger.info(f"MarketAnalysisAgent: {decision} (confidence: {confidence:.2f}, symbol: {symbol})")
            return decision, confidence

        if self.signal_cooldown[symbol] > 0:
            reduced_confidence = max(0.3, confidence - 0.1 * self.signal_cooldown[symbol])
            logger.info(
                f"MarketAnalysisAgent: {self.last_signal[symbol]} (confidence: {reduced_confidence:.2f}, "
                f"cooldown: {self.signal_cooldown[symbol]}, symbol: {symbol})"
            )
            return self.last_signal[symbol], reduced_confidence

        logger.info(f"MarketAnalysisAgent: {decision} (confidence: {confidence:.2f}, symbol: {symbol})")
        return decision, confidence

class DecisionMaker:
    def __init__(self, quorum: int = 2, trade_logger: Optional[TradeLogger] = None):
        self.quorum = quorum
        self.weights = {
            "market_analysis": 3,
            "sentiment": 1,
            "prediction": 2
        }
        self.last_decision: Dict[str, str] = {}
        self.decision_count: Dict[str, int] = {}
        self.min_confidence_threshold = 0.4
        self.buy_threshold = 0.10
        self.sell_threshold = 0.35
        self.hold_requirement = 0.4

        self.trade_logger = trade_logger or TradeLogger()
        self.trade_stats: Dict[str, Dict] = {}
        self.rolling_window_size = 10

        self.risk_manager = RiskManager({
            "BTCUSDT": {"capital": 50, "min_qty": 0.0005},
            "ETHUSDT": {"capital": 50, "min_qty": 0.005}
        })
        self.entry_prices: Dict[str, float] = {}  # Track entry prices for PNL calculation

    def update_rolling_accuracy(self, symbol: str, correct: bool) -> float:
        """Update rolling accuracy for the given symbol."""
        if symbol not in self.trade_stats:
            self.trade_stats[symbol] = {
                "total": 0,
                "correct": 0,
                "accuracy": 0.0,
                "rolling_results": []
            }

        self.trade_stats[symbol]["rolling_results"].append(1 if correct else 0)
        if len(self.trade_stats[symbol]["rolling_results"]) > self.rolling_window_size:
            self.trade_stats[symbol]["rolling_results"].pop(0)

        rolling_acc = (
            sum(self.trade_stats[symbol]["rolling_results"]) / len(self.trade_stats[symbol]["rolling_results"])
            if self.trade_stats[symbol]["rolling_results"] else 0.0
        )
        return rolling_acc

    def calculate_trade_pnl(self, symbol: str, current_price: float, action: str) -> float:
        """Calculate profit/loss for a trade."""
        if symbol not in self.entry_prices:
            logger.warning(f"No entry price found for {symbol}. Cannot calculate PNL.")
            return 0.0

        entry_price = self.entry_prices[symbol]
        if action == "sell":
            pnl = (current_price - entry_price) / entry_price * 100  # PNL as percentage
            logger.info(f"Calculated PNL for {symbol}: {pnl:.2f}% (Entry: {entry_price}, Exit: {current_price})")
            return pnl
        return 0.0

    def decide(self, signals: Dict[str, Tuple[str, float]], symbol: Optional[str] = None, current_price: Optional[float] = None) -> Tuple[str, float]:
        """Make a trading decision based on agent signals."""
        if symbol:
            symbol = symbol.upper()

        if not symbol:
            logger.error("Symbol is required for decision making.")
            return "hold", 0.3

        # Initialize decision tracking for this symbol
        if symbol not in self.last_decision:
            self.last_decision[symbol] = "hold"
            self.decision_count[symbol] = 0

        buy_votes = 0
        sell_votes = 0
        hold_votes = 0
        total_confidence = 0.0
        weighted_confidence_sum = 0.0
        total_weights = sum(self.weights.get(agent, 1) for agent in signals.keys())

        logger.info(f"Agent decisions for {symbol}:")
        for agent, (signal, confidence) in signals.items():
            weight = self.weights.get(agent, 1)
            logger.info(f"  {agent}: {signal} (confidence: {confidence:.2f}, weight: {weight})")

            if signal == "buy":
                buy_votes += weight
                weighted_confidence_sum += confidence * weight
            elif signal == "sell":
                sell_votes += weight
                weighted_confidence_sum += confidence * weight
            else:
                hold_votes += weight
                weighted_confidence_sum += confidence * weight
            total_confidence += confidence

        buy_percentage = buy_votes / total_weights if total_weights > 0 else 0
        sell_percentage = sell_votes / total_weights if total_weights > 0 else 0
        hold_percentage = hold_votes / total_weights if total_weights > 0 else 0
        avg_confidence = weighted_confidence_sum / total_weights if total_weights > 0 else 0.0

        logger.info(f"Vote distribution for {symbol}: buy={buy_percentage:.2f}, sell={sell_percentage:.2f}, hold={hold_percentage:.2f}")
        logger.info(f"Average confidence for {symbol}: {avg_confidence:.2f}")

        decision = "hold"
        final_confidence = avg_confidence

        if hold_percentage >= self.hold_requirement:
            if buy_percentage == hold_percentage and buy_percentage > 0:
                decision = "buy"
            elif sell_percentage == hold_percentage and sell_percentage > 0:
                decision = "sell"
            else:
                decision = "hold"
        elif buy_votes >= self.quorum and buy_percentage > self.buy_threshold:
            decision = "buy"
        elif sell_votes >= self.quorum and sell_percentage > self.sell_threshold:
            decision = "sell"
        elif signals.get("market_analysis")[0] == "buy" and self.last_decision[symbol] != "sell":
            if buy_percentage >= 0.3:
                decision = "buy"
        elif signals.get("market_analysis")[0] == "sell" and self.last_decision[symbol] != "buy":
            if sell_percentage >= 0.3:
                decision = "sell"
        elif self.last_decision[symbol] == "buy" and buy_percentage > 0.2:
            decision = "buy"
        elif self.last_decision[symbol] == "sell" and sell_percentage > 0.2:
            decision = "sell"

        if decision == self.last_decision[symbol]:
            self.decision_count[symbol] += 1
        else:
            self.decision_count[symbol] = 1

        if decision in ["buy", "sell"]:
            estimated_trade_amount = 0.001  # Placeholder; replace with actual amount
            portfolio_value = None  # Replace with actual portfolio value if available
            if not self.risk_manager.is_within_limit(symbol, estimated_trade_amount, portfolio_value):
                logger.info(f"Risk manager overriding {decision} to hold due to exposure limits for {symbol}")
                decision = "hold"
                final_confidence = 0.3

        if decision in ["buy", "sell"] and current_price:
            if decision == "buy":
                self.entry_prices[symbol] = current_price  # Record entry price
            elif decision == "sell" and symbol in self.entry_prices:
                correct = current_price > self.entry_prices[symbol]  # Profit if sell price > entry price
                self.trade_stats.setdefault(symbol, {
                    "total": 0,
                    "correct": 0,
                    "accuracy": 0.0,
                    "rolling_results": []
                })
                self.trade_stats[symbol]["total"] += 1
                if correct:
                    self.trade_stats[symbol]["correct"] += 1
                self.trade_stats[symbol]["accuracy"] = (
                    self.trade_stats[symbol]["correct"] / self.trade_stats[symbol]["total"]
                )
                rolling_acc = self.update_rolling_accuracy(symbol, correct)

                # Calculate PNL
                pnl = self.calculate_trade_pnl(symbol, current_price, decision)
                self.risk_manager.record_pnl(pnl, portfolio_value)

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

        self.last_decision[symbol] = decision
        logger.info(f"Final decision for {symbol}: {decision} (confidence: {final_confidence:.2f}, consecutive count: {self.decision_count[symbol]})")
        return decision, final_confidence

    def execute_trade(self, symbol: str, amount: float, action: str, price: float) -> None:
        """Execute a trade and update risk manager."""
        self.risk_manager.update_exposure(symbol, amount, action, price)
        if hasattr(self, 'portfolio') and hasattr(self.portfolio, 'value'):
            pnl = self.calculate_trade_pnl(symbol, price, action)
            self.risk_manager.record_pnl(pnl, self.portfolio.value)