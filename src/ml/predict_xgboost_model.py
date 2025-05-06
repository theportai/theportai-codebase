import os
import pandas as pd
import numpy as np
import pickle
import xgboost as xgb
from binance.client import Client
from src.ml.feature_engineering import generate_features_labels
import logging
from sklearn.metrics import accuracy_score, classification_report
from dotenv import load_dotenv
import re

# Load environment variables from .env file
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("PortAI-Predict-XGBoost")

def load_artifacts(artifacts_dir):
    """Load model artifacts from the specified directory."""
    try:
        model = pickle.load(open(os.path.join(artifacts_dir, "xgboost_model.pkl"), "rb"))
        feature_names = pickle.load(open(os.path.join(artifacts_dir, "feature_names.pkl"), "rb"))
        scaler = pickle.load(open(os.path.join(artifacts_dir, "feature_scaler.pkl"), "rb"))
        selector = pickle.load(open(os.path.join(artifacts_dir, "feature_selector.pkl"), "rb"))

        # Log the type of scaler and selector for debugging
        logger.info("Type of scaler: %s", type(scaler))
        logger.info("Type of selector: %s", type(selector))

        # Load and parse optimal_thresholds.txt
        thresholds = {}
        try:
            with open(os.path.join(artifacts_dir, "optimal_thresholds.txt"), "r") as f:
                content = f.read().strip()
                logger.info("Raw content of optimal_thresholds.txt: %s", content)

                # Use regex to find key-value pairs (e.g., -1: 0.23307471)
                pattern = r"(-?\d+)\s*:\s*(\d*\.\d+)"
                matches = re.findall(pattern, content)
                
                for key, value in matches:
                    thresholds[int(key)] = float(value)

                if not thresholds:
                    raise ValueError("No valid key-value pairs found in optimal_thresholds.txt")

        except Exception as e:
            logger.warning("Failed to parse optimal_thresholds.txt: %s. Using default thresholds.", str(e))
            # Fallback to default thresholds (based on training logs)
            thresholds = {-1: 0.23307471, 0: 0.18461773, 1: 0.324112}

        logger.info("Loaded thresholds: %s", thresholds)
        logger.info("Loaded model artifacts from %s", artifacts_dir)
        return model, feature_names, scaler, selector, thresholds
    except Exception as e:
        logger.error("Failed to load artifacts: %s", str(e))
        raise

def fetch_recent_candles(symbol, interval="1h", limit=500):
    """Fetch recent candles for the given symbol from Binance."""
    try:
        # Load API keys from .env (match the key names in .env file)
        api_key = os.getenv("BINANCE_API_KEY")
        api_secret = os.getenv("BINANCE_SECRET")
        if not api_key or not api_secret:
            raise ValueError("Binance API key or secret not found in .env file.")

        client = Client(api_key, api_secret)
        klines = client.get_klines(symbol=symbol, interval=interval, limit=limit)
        candles = [
            {
                "open_time": kline[0],
                "open": float(kline[1]),
                "high": float(kline[2]),
                "low": float(kline[3]),
                "close": float(kline[4]),
                "volume": float(kline[5])
            }
            for kline in klines
        ]
        logger.info("Fetched %d recent candles for %s", len(candles), symbol)
        return candles
    except Exception as e:
        logger.error("Failed to fetch candles for %s: %s", symbol, str(e))
        raise

def predict_xgboost_model(symbol, artifacts_dir="model_artifacts_20250506_200905", evaluate=False):
    """Make predictions for the given symbol using the trained XGBoost model."""
    try:
        # Load model artifacts
        model, feature_names, scaler, selector, thresholds = load_artifacts(artifacts_dir)

        # Fetch recent candles
        candles = fetch_recent_candles(symbol)

        # Generate features and labels (use enhanced labels for evaluation)
        X, y = generate_features_labels(candles, use_enhanced_labels=evaluate)
        logger.info("Generated features: %s", X.shape)

        # Ensure features match the expected order
        X = X[feature_names]

        # Scale and select features
        # Check if scaler is a numpy array (indicating it might be pre-scaled data)
        if isinstance(scaler, np.ndarray):
            logger.warning("Scaler is a numpy array, not a scikit-learn scaler. Skipping scaling step.")
            X_scaled = X  # Skip scaling for now
        else:
            X_scaled = scaler.transform(X)

        # Check if selector is a scikit-learn selector
        if hasattr(selector, 'transform'):
            # Convert X_scaled to a numpy array to avoid feature name mismatch warning
            X_selected = selector.transform(X_scaled.values if isinstance(X_scaled, pd.DataFrame) else X_scaled)
        else:
            logger.warning("Selector does not have a transform method. Using features as-is.")
            X_selected = X_scaled

        logger.info("Processed features: %s", X_selected.shape)

        # Prepare feature names for DMatrix
        if hasattr(selector, 'get_support'):
            # Convert feature_names to a numpy array for boolean indexing
            feature_names_array = np.array(feature_names)
            selected_features = feature_names_array[selector.get_support()].tolist()  # Convert to list
            logger.info("Selected feature names: %s", selected_features)
        else:
            selected_features = feature_names
            logger.warning("Selector does not have get_support method. Using all feature names: %s", selected_features)

        # Make predictions
        dmatrix = xgb.DMatrix(X_selected, feature_names=selected_features)
        probs = model.predict(dmatrix)
        logger.info("Prediction probabilities: %s", probs.shape)

        # Apply thresholds to get final predictions
        predictions = []
        for prob in probs:
            # Assuming prob order: [-1, 0, 1]
            if prob[0] > thresholds[-1]:
                predictions.append(-1)  # Sell
            elif prob[2] > thresholds[1]:
                predictions.append(1)   # Buy
            else:
                predictions.append(0)   # Hold
        predictions = np.array(predictions)

        # Log the latest prediction
        latest_pred = predictions[-1]
        latest_probs = probs[-1]
        logger.info("Latest prediction for %s: %d (Sell: %.2f%%, Hold: %.2f%%, Buy: %.2f%%)",
                    symbol, latest_pred, latest_probs[0]*100, latest_probs[1]*100, latest_probs[2]*100)

        # Evaluate predictions if requested
        if evaluate:
            # Ensure y and predictions have the same length
            min_length = min(len(y), len(predictions))
            y = y[:min_length]
            predictions_eval = predictions[:min_length]

            accuracy = accuracy_score(y, predictions_eval)
            report = classification_report(y, predictions_eval, target_names=["Sell", "Hold", "Buy"])
            logger.info("Evaluation on %s data:\nAccuracy: %.2f%%\n%s", symbol, accuracy * 100, report)

        return predictions, probs

    except Exception as e:
        logger.error("Prediction failed: %s", str(e))
        raise

if __name__ == "__main__":
    # Make predictions for ETHUSDT
    symbol = "ETHUSDT"
    predictions, probabilities = predict_xgboost_model(symbol, evaluate=True)