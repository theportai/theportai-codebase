import matplotlib.pyplot as plt # type: ignore

def plot_trend_comparison(trend_comparisons):
    timestamps = [point["timestamp"] for point in trend_comparisons]
    predicted = [point["predicted"] for point in trend_comparisons]
    actual = [point["actual"] for point in trend_comparisons]

    match = [p == a for p, a in zip(predicted, actual)]

    # Map trend to numerical values
    trend_map = {"bullish": 1, "neutral": 0, "bearish": -1}
    predicted_vals = [trend_map[t] for t in predicted]
    actual_vals = [trend_map[t] for t in actual]

    # Plotting
    plt.figure(figsize=(15, 6))
    plt.plot(timestamps, actual_vals, label="Actual", linestyle='--', marker='o', alpha=0.6)
    plt.plot(timestamps, predicted_vals, label="Predicted", linestyle='-', marker='x', alpha=0.6)

    for i in range(len(timestamps)):
        color = "green" if match[i] else "red"
        plt.scatter(timestamps[i], predicted_vals[i], c=color, s=40)

    plt.title("📈 Trend Match: Predicted vs Actual")
    plt.ylabel("Trend: 1 (Bullish), 0 (Neutral), -1 (Bearish)")
    plt.xticks(rotation=45)
    plt.grid(True)
    plt.legend()
    plt.tight_layout()
    plt.show()