import pandas as pd # type: ignore
import numpy as np # type: ignore
from sklearn.metrics import classification_report, confusion_matrix # type: ignore
import matplotlib.pyplot as plt # type: ignore
import seaborn as sns # type: ignore
from pathlib import Path

# Paths
TRADE_LOG_PATH = Path("logs/trade_log.csv")
TREND_LOG_PATH = Path("logs/trend_match_log.csv")

def compute_agent_accuracy(trade_log):
    total = len(trade_log)
    win_trades = (trade_log["pnl"] > 0).sum()
    win_rate = round((win_trades / total) * 100, 2) if total > 0 else 0.0
    return total, win_rate

def analyze_trend_match(trend_log):
    correct = (trend_log["predicted"] == trend_log["actual"]).sum()
    total = len(trend_log)
    match_rate = round((correct / total) * 100, 2) if total > 0 else 0.0
    return match_rate

def generate_confusion_matrix(trend_log):
    y_true = trend_log["actual"]
    y_pred = trend_log["predicted"]
    matrix = confusion_matrix(y_true, y_pred, labels=[-1, 0, 1])
    return matrix

def generate_scorecard():
    print("📊 Generating AI Evaluation Scorecard...\n")

    if not TRADE_LOG_PATH.exists() or not TREND_LOG_PATH.exists():
        print("❌ Missing logs. Make sure trade_log.csv and trend_match_log.csv exist in logs/")
        return

    trade_log = pd.read_csv(TRADE_LOG_PATH)
    trend_log = pd.read_csv(TREND_LOG_PATH)

    total_trades, win_rate = compute_agent_accuracy(trade_log)
    print(f"✅ Total Trades: {total_trades}")
    print(f"🏆 Win Rate: {win_rate}%\n")

    match_rate = analyze_trend_match(trend_log)
    print(f"🔍 ML Trend Match Accuracy: {match_rate}%\n")

    report = classification_report(
        trend_log["actual"], trend_log["predicted"], labels=[-1, 0, 1], output_dict=True
    )
    report_df = pd.DataFrame(report).transpose()
    print("📈 Classification Report (Prediction Agent):")
    print(report_df.round(2))

    matrix = generate_confusion_matrix(trend_log)
    plt.figure(figsize=(6, 5))
    sns.heatmap(matrix, annot=True, fmt="d", cmap="Blues", xticklabels=["Bearish", "Neutral", "Bullish"],
                yticklabels=["Bearish", "Neutral", "Bullish"])
    plt.title("Prediction Agent - Confusion Matrix")
    plt.xlabel("Predicted")
    plt.ylabel("Actual")
    plt.tight_layout()
    plt.savefig("logs/confusion_matrix.png")
    print("\n🖼️ Confusion Matrix saved to logs/confusion_matrix.png")

if __name__ == "__main__":
    generate_scorecard()