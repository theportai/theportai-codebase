import matplotlib.pyplot as plt # type: ignore
from collections import defaultdict

def evaluate_agent_accuracy(candles):
    results = {}
    agent_keys = {
        "market_analysis": "market_analysis_signal",
        "sentiment": "sentiment_signal",
        "prediction": "prediction_signal"
    }

    for agent, key in agent_keys.items():
        total = 0
        correct = 0

        for i in range(len(candles) - 1):
            signal = candles[i].get(key)
            pred = (
                "bullish" if signal == "buy"
                else "bearish" if signal == "sell"
                else "neutral"
            )

            actual_trend = (
                "bullish" if candles[i+1]["close"] > candles[i]["close"]
                else "bearish" if candles[i+1]["close"] < candles[i]["close"]
                else "neutral"
            )

            if pred == actual_trend:
                correct += 1
            total += 1

        results[agent] = round((correct / total) * 100, 2) if total > 0 else 0.0

    return results


def trend_to_label(signal):
    if signal == "buy":
        return 1
    elif signal == "sell":
        return -1
    elif signal == "hold":
        return 0
    return None


def plot_agent_accuracy(accuracy_dict):
    agents = list(accuracy_dict.keys())
    accuracies = list(accuracy_dict.values())

    plt.figure(figsize=(8, 5))
    bars = plt.bar(agents, accuracies)

    for bar in bars:
        yval = bar.get_height()
        plt.text(bar.get_x() + bar.get_width()/2, yval + 1, f"{yval:.1f}%", ha='center')

    plt.ylim(0, 100)
    plt.title("📈 Agent Accuracy over Historical Data")
    plt.ylabel("Accuracy (%)")
    plt.grid(True, linestyle="--", alpha=0.6)
    plt.show()