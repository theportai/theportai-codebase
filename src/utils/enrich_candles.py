from datetime import datetime

def enrich_candle_data(candles):
    """
    Adds momentum to each candle based on previous close price.
    """
    for i in range(1, len(candles)):
        prev_close = candles[i - 1]["close"]
        curr_close = candles[i]["close"]
        momentum = (curr_close - prev_close) / prev_close
        candles[i]["momentum"] = momentum
    return candles


def decision_to_trend(decision: str) -> str:
    """
    Converts a trading decision into a trend label.
    """
    if decision == "buy":
        return "bullish"
    elif decision == "sell":
        return "bearish"
    return "neutral"


def generate_trend_comparisons(ohlcv):
    """
    Compares the predicted trend (based on AI decision) vs the actual trend (based on price movement).
    Returns a list of dictionaries with timestamp, predicted trend, and actual trend.
    """
    trend_comparisons = []

    for i in range(len(ohlcv) - 1):
        current = ohlcv[i]
        future = ohlcv[i + 1]

        predicted = decision_to_trend(current.get("final_decision", "hold"))
        actual = (
            "bullish" if future["close"] > current["close"]
            else "bearish" if future["close"] < current["close"]
            else "neutral"
        )

        trend_comparisons.append({
            "timestamp": datetime.fromisoformat(current["timestamp"]) if isinstance(current["timestamp"], str) else current["timestamp"],
            "predicted": predicted,
            "actual": actual,
        })

    return trend_comparisons