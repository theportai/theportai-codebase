import pandas as pd # type: ignore
import numpy as np # type: ignore


def compute_technical_indicators(df):
    df["momentum"] = df["close"].diff() / df["close"].shift(1)
    df["sma_short"] = df["close"].rolling(window=5).mean()
    df["sma_long"] = df["close"].rolling(window=20).mean()
    df["sma_diff"] = df["sma_short"] - df["sma_long"]

    delta = df["close"].diff()
    gain = delta.where(delta > 0, 0).rolling(window=14).mean()
    loss = -delta.where(delta < 0, 0).rolling(window=14).mean()
    rs = gain / loss
    df["rsi"] = 100 - (100 / (1 + rs))

    exp1 = df["close"].ewm(span=12, adjust=False).mean()
    exp2 = df["close"].ewm(span=26, adjust=False).mean()
    df["macd"] = exp1 - exp2
    df["macd_signal"] = df["macd"].ewm(span=9, adjust=False).mean()

    return df


def generate_features_labels(candles):
    df = pd.DataFrame(candles)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    df.set_index("timestamp", inplace=True)

    df = compute_technical_indicators(df)

    # Label: +1 if price will go up, -1 if down, 0 if neutral
    df["target"] = np.sign(df["close"].shift(-1) - df["close"])
    df["target"] = df["target"].fillna(0)

    features = ["momentum", "sma_diff", "rsi", "macd", "macd_signal"]
    df = df.dropna()

    X = df[features]
    y = df["target"]

    return X, y