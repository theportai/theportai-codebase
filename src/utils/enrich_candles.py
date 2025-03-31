import random
import pandas as pd # type: ignore

def enrich_candle_data(candles, momentum_window=5):
    df = pd.DataFrame(candles)

    # Calculate momentum
    df["momentum"] = df["close"].diff(periods=momentum_window).fillna(0)

    # Simulate sentiment score for now
    df["sentiment_score"] = [random.uniform(-1, 1) for _ in range(len(df))]

    return df.to_dict(orient="records")