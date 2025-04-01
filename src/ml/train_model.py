import pandas as pd # type: ignore
import joblib # type: ignore
from sklearn.ensemble import RandomForestClassifier # type: ignore
from sklearn.model_selection import train_test_split # type: ignore
from sklearn.metrics import classification_report # type: ignore

from src.data.postgres_ohlcv_loader import get_ohlcv_from_db
from src.ml.feature_engineering import generate_features_labels

def create_labels(df):
    labels = []
    for i in range(len(df) - 1):
        future_price = df.iloc[i + 1]["close"]
        current_price = df.iloc[i]["close"]
        change = (future_price - current_price) / current_price
        if change > 0.002:
            labels.append(1)
        elif change < -0.002:
            labels.append(-1)
        else:
            labels.append(0)
    labels.append(0)  # last row no future data
    return labels

def train_model():
    print("📥 Fetching historical data from PostgreSQL...")
    raw_candles = get_ohlcv_from_db("BTCUSDT", limit=1000)

    print("🧠 Enriching with features...")
    df = pd.DataFrame(raw_candles)
    df.dropna(inplace=True)

    # Generate features + labels from enriched candles
    enriched_candles = df.to_dict("records")
    X, y = generate_features_labels(enriched_candles)

    # Truncate y to match X length if needed
    if len(y) > len(X):
        y = y[:len(X)]

    print(f"📊 X shape: {X.shape} | y shape: {len(y)}")

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, stratify=y)

    print("🔁 Training Random Forest Classifier...")
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    print("🎯 Classification Report:\n", classification_report(y_test, y_pred))

    joblib.dump(model, "src/ml/prediction_model.pkl")
    print("✅ Model saved to src/ml/prediction_model.pkl")

if __name__ == "__main__":
    train_model()