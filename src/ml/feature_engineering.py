import pandas as pd
import numpy as np
from typing import List

def compute_technical_indicators(df):
    # Ensure required columns exist
    required_columns = ["open", "high", "low", "close", "volume"]
    for col in required_columns:
        if col not in df.columns:
            raise ValueError(f"Missing required column: {col}")

    # Momentum: (close - close.shift(1)) / close.shift(1)
    close_shifted = df["close"].shift(1)
    df["momentum"] = df["close"].diff() / close_shifted.where(close_shifted != 0, 1e-10)

    # SMA difference
    df["sma_5"] = df["close"].rolling(window=5).mean()
    df["sma_20"] = df["close"].rolling(window=20).mean()
    df["sma_50"] = df["close"].rolling(window=50).mean()
    df["sma_200"] = df["close"].rolling(window=200).mean()
    df["sma_diff"] = df["sma_5"] - df["sma_20"]

    # RSI (14-period)
    delta = df["close"].diff()
    gain = delta.where(delta > 0, 0).rolling(window=14).mean()
    loss = -delta.where(delta < 0, 0).rolling(window=14).mean()
    rs = gain / loss.where(loss != 0, 1e-10)
    df["rsi"] = 100 - (100 / (1 + rs))
    df["rsi_14"] = df["rsi"]  # Alias for consistency

    # MACD
    exp1 = df["close"].ewm(span=12, adjust=False).mean()
    exp2 = df["close"].ewm(span=26, adjust=False).mean()
    df["macd"] = exp1 - exp2
    df["macd_signal"] = df["macd"].ewm(span=9, adjust=False).mean()

    # Trend Strength (ADX approximation using price movement)
    high_low = df["high"] - df["low"]
    df["trend_strength"] = high_low.rolling(window=14).mean() / df["close"].rolling(window=14).mean()

    # ATR (14-period)
    tr1 = (df["high"] - df["low"]).abs()
    tr2 = (df["high"] - df["close"].shift(1)).abs()
    tr3 = (df["low"] - df["close"].shift(1)).abs()
    true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    df["atr_14"] = true_range.rolling(window=14).mean()

    # Volatility (14-period)
    df["volatility_14"] = df["close"].pct_change().rolling(window=14).std()
    df["volatility_ratio"] = df["volatility_14"] / df["volatility_14"].shift(1).where(df["volatility_14"].shift(1) != 0, 1e-10)

    # Price Momentum (alternative momentum)
    df["price_momentum"] = df["close"] / df["close"].shift(5).where(df["close"].shift(5) != 0, 1e-10) - 1

    # Volume Features
    df["volume_change"] = df["volume"].pct_change()
    df["volume_ma_5"] = df["volume"].rolling(window=5).mean()
    df["volume_ma_ratio"] = df["volume"] / df["volume_ma_5"].where(df["volume_ma_5"] != 0, 1e-10)
    df["volume_price_trend"] = (df["volume"] * (df["close"] - df["close"].shift(1))).cumsum()
    df["volume_divergence"] = df["volume"] - df["volume"].shift(1)

    # Candlestick Features
    df["body_size"] = (df["close"] - df["open"]).abs()
    df["upper_shadow"] = df["high"] - df[["open", "close"]].max(axis=1)
    df["lower_shadow"] = df[["open", "close"]].min(axis=1) - df["low"]
    df["close_position"] = (df["close"] - df["low"]) / (df["high"] - df["low"]).where((df["high"] - df["low"]) != 0, 1e-10)

    # Price-SMA Ratio
    df["price_sma_ratio"] = df["close"] / df["sma_20"].where(df["sma_20"] != 0, 1e-10)

    # Bollinger Bands
    rolling_mean = df["close"].rolling(window=20).mean()
    rolling_std = df["close"].rolling(window=20).std()
    df["bollinger_upper"] = rolling_mean + (rolling_std * 2)
    df["bollinger_lower"] = rolling_mean - (rolling_std * 2)
    df["bollinger_position"] = (df["close"] - df["bollinger_lower"]) / (df["bollinger_upper"] - df["bollinger_lower"]).where((df["bollinger_upper"] - df["bollinger_lower"]) != 0, 1e-10)
    df["bb_width"] = (df["bollinger_upper"] - df["bollinger_lower"]) / rolling_mean.where(rolling_mean != 0, 1e-10)

    # Pivot Proximity (distance to recent high/low)
    df["pivot_high"] = df["high"].rolling(window=5, center=True).max()
    df["pivot_low"] = df["low"].rolling(window=5, center=True).min()
    df["pivot_proximity"] = (df["close"] - df["pivot_low"]) / (df["pivot_high"] - df["pivot_low"]).where((df["pivot_high"] - df["pivot_low"]) != 0, 1e-10)

    # SMA Crossovers
    df["sma_20_50_cross"] = (df["sma_20"] > df["sma_50"]).astype(int) - (df["sma_20"] < df["sma_50"]).astype(int)
    df["sma_50_200_cross"] = (df["sma_50"] > df["sma_200"]).astype(int) - (df["sma_50"] < df["sma_200"]).astype(int)

    # Replace inf with large finite numbers and NaN with 0
    df = df.replace([np.inf, -np.inf], 1e10)
    df = df.fillna(0)

    return df

def create_enhanced_labels(df: pd.DataFrame, threshold_buy: float = 0.0035, threshold_sell: float = 0.0028, lookforward_periods: List[int] = [3, 5, 8]) -> np.ndarray:
    all_labels = []

    for period in lookforward_periods:
        period_labels = []
        for i in range(len(df) - max(lookforward_periods)):
            future_price = df.iloc[i + period]["close"]
            current_price = df.iloc[i]["close"]
            change = (future_price - current_price) / current_price if current_price != 0 else 0

            if change > threshold_buy:
                period_labels.append(1)
            elif change < -threshold_sell:
                period_labels.append(-1)
            else:
                period_labels.append(0)

        period_labels.extend([0] * (len(df) - len(period_labels)))
        all_labels.append(period_labels)

    all_labels = np.array(all_labels)

    final_labels = []
    for i in range(all_labels.shape[1]):
        votes = all_labels[:, i]
        if 1 in votes and -1 not in votes:
            final_labels.append(1)
        elif -1 in votes and 1 not in votes:
            final_labels.append(-1)
        else:
            buy_votes = np.sum(votes == 1)
            sell_votes = np.sum(votes == -1)
            hold_votes = np.sum(votes == 0)

            if buy_votes > sell_votes and buy_votes > hold_votes:
                final_labels.append(1)
            elif sell_votes > buy_votes and sell_votes > hold_votes:
                final_labels.append(-1)
            else:
                final_labels.append(0)

    return np.array(final_labels)

def generate_features_labels(candles, use_enhanced_labels: bool = False):
    df = pd.DataFrame(candles)
    
    # Handle timestamp column (Binance often uses 'open_time' instead of 'timestamp')
    if "timestamp" not in df.columns and "open_time" in df.columns:
        df["timestamp"] = pd.to_datetime(df["open_time"], unit="ms")
    elif "timestamp" in df.columns:
        df["timestamp"] = pd.to_datetime(df["timestamp"])
    else:
        raise ValueError("No 'timestamp' or 'open_time' column found in the data")

    # Extract time-based features
    df["hour"] = df["timestamp"].dt.hour
    df["day_of_week"] = df["timestamp"].dt.dayofweek

    # Set timestamp as index
    df.set_index("timestamp", inplace=True)

    # Compute technical indicators
    df = compute_technical_indicators(df)

    # Define all features used during training
    features = [
        "momentum", "sma_diff", "rsi", "macd", "macd_signal", "trend_strength",
        "atr_14", "volatility_14", "volatility_ratio", "rsi_14", "price_momentum",
        "volume_change", "volume_ma_ratio", "volume_price_trend", "volume_divergence",
        "body_size", "upper_shadow", "lower_shadow", "close_position", "price_sma_ratio",
        "bollinger_position", "bb_width", "pivot_proximity", "sma_20_50_cross",
        "sma_50_200_cross", "hour", "day_of_week"
    ]

    # Label generation
    if use_enhanced_labels:
        df["target"] = create_enhanced_labels(df)
    else:
        df["target"] = np.sign(df["close"].shift(-1) - df["close"])
        df["target"] = df["target"].fillna(0)

    # Drop rows with NaN values
    df = df.dropna()

    # Select features and labels
    X = df[features]
    y = df["target"]

    # Final check for invalid values
    X = X.replace([np.inf, -np.inf], 1e10)
    X = X.fillna(0)

    return X, y