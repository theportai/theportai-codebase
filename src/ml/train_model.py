import pandas as pd # type: ignore
import numpy as np # type: ignore
import joblib # type: ignore
from sklearn.ensemble import RandomForestClassifier # type: ignore
from sklearn.preprocessing import StandardScaler # type: ignore
from sklearn.model_selection import train_test_split, GridSearchCV # type: ignore
from sklearn.metrics import classification_report, confusion_matrix # type: ignore
import matplotlib.pyplot as plt # type: ignore
import seaborn as sns # type: ignore

from src.data.postgres_ohlcv_loader import get_ohlcv_from_db
from src.ml.feature_engineering import generate_features_labels

def create_enhanced_labels(df, threshold=0.002):
    """
    Create enhanced labels with more granular price movement predictions.
    
    Args:
        df: DataFrame with OHLCV data
        threshold: Price change threshold for buy/sell signals (0.2%)
        
    Returns:
        Array of labels: 1 (buy), 0 (hold), -1 (sell)
    """
    labels = []
    for i in range(len(df) - 1):
        future_price = df.iloc[i + 1]["close"]
        current_price = df.iloc[i]["close"]
        
        # Calculate percentage change
        change = (future_price - current_price) / current_price
        
        # Assign label based on change and threshold
        if change > threshold:
            labels.append(1)  # Buy signal
        elif change < -threshold:
            labels.append(-1)  # Sell signal
        else:
            labels.append(0)  # Hold signal
            
    labels.append(0)  # Last row (no future data)
    return labels

def evaluate_model(model, X_test, y_test):
    """
    Evaluate model performance with detailed metrics and visualizations.
    """
    # Make predictions
    y_pred = model.predict(X_test)
    
    # Print classification report
    print("🎯 Classification Report:\n", classification_report(y_test, y_pred))
    
    # Calculate confusion matrix
    cm = confusion_matrix(y_test, y_pred)
    
    # Calculate class-specific accuracies
    class_accuracy = {}
    for i, label in enumerate([-1, 0, 1]):  # Sell, Hold, Buy
        if label in np.unique(y_test):
            true_indices = np.where(y_test == label)[0]
            if len(true_indices) > 0:
                correct = np.sum(y_pred[true_indices] == label)
                class_accuracy[label] = correct / len(true_indices)
    
    print("Class-specific accuracies:")
    print(f"Buy accuracy: {class_accuracy.get(1, 0):.2%}")
    print(f"Hold accuracy: {class_accuracy.get(0, 0):.2%}")
    print(f"Sell accuracy: {class_accuracy.get(-1, 0):.2%}")
    
    # Calculate feature importances
    if hasattr(model, 'feature_importances_'):
        importances = model.feature_importances_
        indices = np.argsort(importances)[::-1]
        
        print("\n🔍 Top 10 important features:")
        feature_names = X_test.columns
        for i in range(min(10, len(feature_names))):
            print(f"{feature_names[indices[i]]}: {importances[indices[i]]:.4f}")
    
    return y_pred, class_accuracy

def train_model():
    print("📥 Fetching historical data from PostgreSQL...")
    # Increased data amount for better training
    raw_candles = get_ohlcv_from_db("BTCUSDT", limit=5000)  # Use more historical data

    print("🧠 Enriching with features...")
    df = pd.DataFrame(raw_candles)
    df.dropna(inplace=True)

    # Generate features + labels from enriched candles
    enriched_candles = df.to_dict("records")
    X, y = generate_features_labels(enriched_candles)
    
    # Check if we need custom labels (if generate_features_labels doesn't create them)
    if isinstance(y, type(None)) or len(y) == 0:
        print("Creating custom labels...")
        y = create_enhanced_labels(df)

    # Truncate y to match X length if needed
    if len(y) > len(X):
        y = y[:len(X)]
    elif len(X) > len(y):
        X = X[:len(y)]

    print(f"📊 X shape: {X.shape} | y shape: {len(y)}")
    
    # Check class distribution
    unique_classes, counts = np.unique(y, return_counts=True)
    print("Class distribution:", dict(zip(unique_classes, counts)))
    
    # Handle class imbalance if needed
    class_weights = None
    if len(unique_classes) > 1:
        total_samples = len(y)
        class_weights = {cls: total_samples / (len(unique_classes) * count) for cls, count in zip(unique_classes, counts)}
        print("Class weights:", class_weights)

    # Feature scaling
    scaler = StandardScaler()
    X_scaled = pd.DataFrame(scaler.fit_transform(X), columns=X.columns)
    
    # Split the data
    X_train, X_test, y_train, y_test = train_test_split(
        X_scaled, y, test_size=0.2, random_state=42, stratify=y
    )

    print("🔍 Optimizing model with GridSearchCV...")
    # Define parameter grid for optimization
    param_grid = {
        'n_estimators': [100, 200],
        'max_depth': [None, 10, 20],
        'min_samples_split': [2, 5],
        'min_samples_leaf': [1, 2],
        'class_weight': ['balanced', 'balanced_subsample', None]
    }
    
    # Use a basic model for initial grid search to save time
    basic_rf = RandomForestClassifier(random_state=42)
    grid_search = GridSearchCV(
        estimator=basic_rf,
        param_grid=param_grid,
        cv=3,
        n_jobs=-1,
        verbose=1,
        scoring='f1_weighted'
    )
    
    # Fit the grid search
    grid_search.fit(X_train, y_train)
    
    # Get best parameters
    best_params = grid_search.best_params_
    print("Best parameters:", best_params)
    
    # Train final model with best parameters
    print("🔁 Training final Random Forest with optimized parameters...")
    final_model = RandomForestClassifier(random_state=42, **best_params)
    final_model.fit(X_train, y_train)
    
    # Evaluate the model
    print("📏 Evaluating model performance...")
    y_pred, class_accuracy = evaluate_model(final_model, X_test, y_test)
    
    # Save model artifacts
    joblib.dump(final_model, "src/ml/prediction_model.pkl")
    joblib.dump(scaler, "src/ml/feature_scaler.pkl")
    
    print("✅ Model saved to src/ml/prediction_model.pkl")
    print("✅ Scaler saved to src/ml/feature_scaler.pkl")
    
    return final_model, scaler, class_accuracy

if __name__ == "__main__":
    train_model()