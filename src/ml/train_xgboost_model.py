import pandas as pd
import numpy as np
import joblib
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split, TimeSeriesSplit
from sklearn.metrics import classification_report, confusion_matrix, f1_score, precision_recall_curve
import xgboost as xgb
import matplotlib.pyplot as plt
import seaborn as sns
from imblearn.over_sampling import ADASYN
from sklearn.feature_selection import SelectFromModel
import optuna
from datetime import datetime
import os
import logging
from typing import Tuple, List, Dict, Optional
import time
from binance.client import Client
from binance.exceptions import BinanceAPIException
from dotenv import load_dotenv

from src.ml.feature_engineering import generate_features_labels

# Load environment variables from .env file
load_dotenv()

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("logs/train_xgboost_model.log"),
        logging.StreamHandler(),
    ]
)
logger = logging.getLogger('PortAI-Train-XGBoost')

def get_ohlcv_from_binance(symbol: str, interval: str = Client.KLINE_INTERVAL_1HOUR, limit: int = 20000) -> List[Dict]:
    try:
        api_key = os.getenv('BINANCE_API_KEY')
        api_secret = os.getenv('BINANCE_SECRET')
        if not api_key or not api_secret:
            raise ValueError("Binance API key or secret not found in environment variables.")

        client = Client(api_key, api_secret)
        logger.info(f"Fetching historical data for {symbol} from Binance...")

        klines = []
        end_time = int(time.time() * 1000)
        requests_needed = (limit + 999) // 1000
        max_retries = 3

        for _ in range(requests_needed):
            for attempt in range(max_retries):
                try:
                    batch = client.get_klines(
                        symbol=symbol,
                        interval=interval,
                        limit=min(1000, limit - len(klines)),
                        endTime=end_time
                    )
                    if not batch:
                        break
                    klines = batch + klines
                    end_time = batch[0][0] - 1
                    time.sleep(0.1)
                    break
                except BinanceAPIException as e:
                    if "APIError(code=-1003): Too many requests" in str(e):
                        logger.warning(f"Rate limit hit, retrying ({attempt+1}/{max_retries})...")
                        time.sleep(10 * (attempt + 1))
                    else:
                        raise e
                except Exception as e:
                    logger.warning(f"Error fetching klines, retrying ({attempt+1}/{max_retries}): {str(e)}")
                    time.sleep(5 * (attempt + 1))
                    if attempt == max_retries - 1:
                        raise e

        if not klines:
            raise ValueError(f"No historical data retrieved for {symbol} from Binance.")

        ohlcv_data = []
        for kline in klines:
            ohlcv_data.append({
                'timestamp': kline[0],
                'open': float(kline[1]),
                'high': float(kline[2]),
                'low': float(kline[3]),
                'close': float(kline[4]),
                'volume': float(kline[5]),
                'symbol': symbol  # Add symbol to track the source
            })

        logger.info(f"Fetched {len(ohlcv_data)} historical candles for {symbol} from Binance.")
        return ohlcv_data

    except Exception as e:
        logger.error(f"Failed to fetch data from Binance: {str(e)}", exc_info=True)
        return []

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

def calculate_rsi(prices: pd.Series, period: int = 14) -> pd.Series:
    delta = prices.diff()
    gain = delta.where(delta > 0, 0).rolling(window=period).mean()
    loss = -delta.where(delta < 0, 0).rolling(window=period).mean()
    rs = gain / loss.where(loss != 0, 1e-10)
    rsi = 100 - (100 / (1 + rs))
    return rsi

def calculate_macd(prices: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> pd.Series:
    ema_fast = prices.ewm(span=fast, adjust=False).mean()
    ema_slow = prices.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    return macd_line - signal_line

def calculate_pivot_proximity(df: pd.DataFrame, window: int = 20) -> np.ndarray:
    pivot_high = df['high'].rolling(window, center=True).apply(
        lambda x: x[len(x)//2] == max(x), raw=True
    ).fillna(0)
    pivot_low = df['low'].rolling(window, center=True).apply(
        lambda x: x[len(x)//2] == min(x), raw=True
    ).fillna(0)

    proximity = np.zeros(len(df))

    for i in range(len(df)):
        look_back = 100
        start_idx = max(0, i - look_back)
        recent_highs = []
        recent_lows = []

        for j in range(start_idx, i):
            if j < len(pivot_high) and pivot_high.iloc[j] > 0:
                recent_highs.append(df['high'].iloc[j])
            if j < len(pivot_low) and pivot_low.iloc[j] > 0:
                recent_lows.append(df['low'].iloc[j])

        if not recent_highs and not recent_lows:
            continue

        price = df['close'].iloc[i]
        nearest_distance = float('inf')
        for level in recent_highs + recent_lows:
            distance = abs(price - level) / price if price > 0 else float('inf')
            if distance < nearest_distance:
                nearest_distance = distance

        proximity[i] = 1 - min(nearest_distance * 100, 1)

    return proximity

def add_advanced_features(X: pd.DataFrame, df: pd.DataFrame) -> pd.DataFrame:
    X = pd.DataFrame(X)
    X.index = df.index[:len(X)]
    logger.info(f"Initial X shape in add_advanced_features: {X.shape}")

    close_50_std = df['close'].rolling(50).std()
    X['trend_strength'] = (
        abs(df['close'].rolling(50).mean() - df['close'].rolling(200).mean()) /
        close_50_std.where(close_50_std != 0, 1e-10)
    )

    X['atr_14'] = df['high'].rolling(14).max() - df['low'].rolling(14).min()
    close_14_std = df['close'].rolling(14).std()
    X['volatility_14'] = close_14_std
    close_20_std = df['close'].rolling(20).std()
    X['volatility_ratio'] = df['close'].rolling(5).std() / close_20_std.where(close_20_std != 0, 1e-10)

    X['rsi_14'] = calculate_rsi(df['close'], 14)
    X['macd'] = calculate_macd(df['close'])
    X['price_momentum'] = (
        df['close'].pct_change(5) + df['close'].pct_change(10) + df['close'].pct_change(20)
    )

    X['volume_change'] = df['volume'].pct_change()  # Fixed typo: pctW -> pct_change
    volume_20_mean = df['volume'].rolling(20).mean()
    X['volume_ma_ratio'] = df['volume'] / volume_20_mean.where(volume_20_mean != 0, 1e-10)
    X['volume_price_trend'] = (df['close'] - df['close'].shift(1)) * df['volume']
    X['volume_divergence'] = (
        (df['volume'].rolling(5).mean() / volume_20_mean.where(volume_20_mean != 0, 1e-10)) -
        (df['close'].rolling(5).mean() / df['close'].rolling(20).mean().where(df['close'].rolling(20).mean() != 0, 1e-10))
    )

    high_low_range = df['high'] - df['low']
    high_low_range_safe = high_low_range.where(high_low_range != 0, 1e-10)
    X['body_size'] = abs(df['close'] - df['open']) / high_low_range_safe
    X['upper_shadow'] = (df['high'] - df[['open', 'close']].max(axis=1)) / high_low_range_safe
    X['lower_shadow'] = (df[['open', 'close']].min(axis=1) - df['low']) / high_low_range_safe
    X['close_position'] = (df['close'] - df['low']) / high_low_range_safe

    close_50_mean = df['close'].rolling(50).mean()
    X['price_sma_ratio'] = df['close'] / close_50_mean.where(close_50_mean != 0, 1e-10)
    close_20_mean = df['close'].rolling(20).mean()
    close_20_std = df['close'].rolling(20).std()
    X['bollinger_position'] = (
        (df['close'] - close_20_mean) / (close_20_std * 2).where(close_20_std != 0, 1e-10)
    )
    X['bb_width'] = (
        (close_20_mean + 2 * close_20_std - (close_20_mean - 2 * close_20_std)) /
        close_20_mean.where(close_20_mean != 0, 1e-10)
    )

    proximity = calculate_pivot_proximity(df)
    X['pivot_proximity'] = proximity[:len(X)]

    sma_20 = df['close'].rolling(20).mean()
    sma_50 = df['close'].rolling(50).mean()
    sma_200 = df['close'].rolling(200).mean()
    X['sma_20_50_cross'] = (sma_20 > sma_50).astype(int) * 2 - 1
    X['sma_50_200_cross'] = (sma_50 > sma_200).astype(int) * 2 - 1

    try:
        if not isinstance(df.index, pd.DatetimeIndex):
            raise ValueError("DataFrame index is not a datetime index")
        X['hour'] = df.index.hour[:len(X)]
        X['day_of_week'] = df.index.dayofweek[:len(X)]
    except Exception as e:
        logger.warning(f"Could not extract time features: {str(e)}")
        X['hour'] = 0
        X['day_of_week'] = 0

    X = X.replace([np.inf, -np.inf], 1e10)
    X = X.bfill()
    X = X.fillna(0)

    logger.info(f"Final X shape after add_advanced_features: {X.shape}")
    return X

def objective(trial, X_train: np.ndarray, y_train: np.ndarray, X_test: np.ndarray, y_test: np.ndarray, class_weights: Dict[int, float]) -> float:
    params = {
        'max_depth': trial.suggest_int('max_depth', 3, 10),
        'learning_rate': trial.suggest_float('learning_rate', 0.005, 0.3, log=True),
        'subsample': trial.suggest_float('subsample', 0.6, 1.0),
        'colsample_bytree': trial.suggest_float('colsample_bytree', 0.6, 1.0),
        'min_child_weight': trial.suggest_int('min_child_weight', 1, 10),
        'gamma': trial.suggest_float('gamma', 0.0, 0.5),
        'scale_pos_weight': trial.suggest_float('scale_pos_weight', 0.8, 5.0),
        'alpha': trial.suggest_float('alpha', 0.0, 10.0),
        'lambda': trial.suggest_float('lambda', 0.0, 10.0),
        'objective': 'multi:softprob',
        'num_class': 3,
        'eval_metric': ['mlogloss', 'merror'],
        'seed': 42
    }

    sample_weights = np.array([class_weights[y] for y in y_train])
    dtrain = xgb.DMatrix(X_train, label=y_train, weight=sample_weights)
    dtest = xgb.DMatrix(X_test, label=y_test)

    evals_result = {}
    bst = xgb.train(
        params,
        dtrain,
        num_boost_round=3000,
        evals=[(dtrain, 'train'), (dtest, 'test')],
        early_stopping_rounds=50,
        evals_result=evals_result,
        verbose_eval=False
    )

    y_pred_probs = bst.predict(dtest)
    y_pred = np.argmax(y_pred_probs, axis=1)

    buy_sell_recall = 0
    y_test_np = np.array(y_test)
    for target_class in [0, 2]:
        class_indices = y_test_np == target_class
        if np.sum(class_indices) > 0:
            recall = np.sum((y_pred == target_class) & class_indices) / np.sum(class_indices)
            buy_sell_recall += recall

    buy_sell_recall /= 2
    f1 = f1_score(y_test, y_pred, average='weighted')
    final_score = (buy_sell_recall * 0.7) + (f1 * 0.3)

    return final_score

def calculate_optimal_thresholds(model: xgb.Booster, X_val: np.ndarray, y_val: np.ndarray, reverse_mapping: Dict[int, int]) -> Dict[int, float]:
    dval = xgb.DMatrix(X_val)
    y_pred_probs = model.predict(dval)

    thresholds = {}

    for class_idx in range(3):
        y_true_binary = (y_val == class_idx).astype(int)
        y_scores = y_pred_probs[:, class_idx]

        precision, recall, thresholds_pr = precision_recall_curve(y_true_binary, y_scores)
        f1_scores = 2 * recall * precision / (recall + precision + 1e-10)

        best_idx = np.argmax(f1_scores)
        if len(thresholds_pr) > best_idx:
            best_threshold = thresholds_pr[best_idx]
        else:
            best_threshold = 0.5

        thresholds[reverse_mapping[class_idx]] = best_threshold

    return thresholds

def predict_with_confidence(model: xgb.Booster, X: np.ndarray, optimal_thresholds: Dict[int, float], reverse_mapping: Dict[int, int]) -> Tuple[np.ndarray, np.ndarray]:
    dmatrix = xgb.DMatrix(X)
    probs = model.predict(dmatrix)

    predictions = []
    confidences = []

    for i in range(len(X)):
        class_probs = probs[i]
        max_class = np.argmax(class_probs)
        max_prob = class_probs[max_class]

        orig_label = reverse_mapping[max_class]
        threshold = optimal_thresholds[orig_label]

        if max_prob >= threshold:
            predictions.append(orig_label)
            confidences.append(max_prob)
        else:
            predictions.append(0)
            confidences.append(max_prob)

    return np.array(predictions), np.array(confidences)

def plot_learning_curves(evals_result: Dict) -> None:
    if not evals_result:
        logger.warning("No evaluation results to plot learning curves.")
        return

    metrics = []
    if 'mlogloss' in evals_result.get('train', {}):
        metrics.append('mlogloss')
    if 'merror' in evals_result.get('train', {}):
        metrics.append('merror')

    if not metrics:
        logger.warning("No metrics found in evaluation results.")
        return

    n_metrics = len(metrics)
    fig, axes = plt.subplots(1, n_metrics, figsize=(6 * n_metrics, 5))

    if n_metrics == 1:
        axes = [axes]

    val_key = None
    for possible_key in ['val', 'test', 'validation']:
        if possible_key in evals_result:
            val_key = possible_key
            break

    if val_key is None:
        logger.warning("No validation results found in evals_result")
        for i, metric in enumerate(metrics):
            epochs = len(evals_result['train'][metric])
            x_axis = range(0, epochs)

            axes[i].plot(x_axis, evals_result['train'][metric], label='Train')
            axes[i].set_title(f'XGBoost {metric.upper()}')
            axes[i].set_xlabel('Boosting Round')
            axes[i].set_ylabel(metric)
            axes[i].legend()
    else:
        for i, metric in enumerate(metrics):
            epochs = len(evals_result['train'][metric])
            x_axis = range(0, epochs)

            axes[i].plot(x_axis, evals_result['train'][metric], label='Train')
            axes[i].plot(x_axis, evals_result[val_key][metric], label=val_key.capitalize())
            axes[i].set_title(f'XGBoost {metric.upper()}')
            axes[i].set_xlabel('Boosting Round')
            axes[i].set_ylabel(metric)
            axes[i].legend()

    plt.tight_layout()
    plt.savefig("learning_curves.png")
    plt.close()

def create_output_directory() -> str:
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = f"model_artifacts_{timestamp}"
    os.makedirs(output_dir, exist_ok=True)
    logger.info(f"Created output directory: {output_dir}")
    return output_dir

def save_feature_importance(model: xgb.Booster, feature_names: List[str], output_dir: str) -> None:
    importance_types = ['weight', 'gain', 'cover', 'total_gain', 'total_cover']

    for imp_type in importance_types:
        try:
            importance = model.get_score(importance_type=imp_type)
            if not importance:
                logger.warning(f"No feature importance data for type: {imp_type}")
                continue

            imp_df = pd.DataFrame({
                'Feature': list(importance.keys()),
                'Importance': list(importance.values())
            }).sort_values('Importance', ascending=False)

            plt.figure(figsize=(10, max(8, len(imp_df) * 0.3)))
            sns.barplot(x='Importance', y='Feature', data=imp_df)
            plt.title(f"Feature Importance ({imp_type})")
            plt.tight_layout()
            plt.savefig(f"{output_dir}/feature_importance_{imp_type}.png")
            plt.close()

            imp_df.to_csv(f"{output_dir}/feature_importance_{imp_type}.csv", index=False)
            logger.info(f"Saved feature importance ({imp_type}) to {output_dir}")
        except Exception as e:
            logger.error(f"Failed to save feature importance for type {imp_type}: {str(e)}")
            continue

def print_model_evaluation(y_test_orig: np.ndarray, y_pred_orig: np.ndarray, confidences: np.ndarray, class_names: List[str], output_dir: str) -> None:
    report = classification_report(y_test_orig, y_pred_orig, output_dict=True)
    report_df = pd.DataFrame(report).transpose()
    report_df.to_csv(f"{output_dir}/classification_report.csv")
    logger.info("Classification Report:\n" + classification_report(y_test_orig, y_pred_orig))

    cm = confusion_matrix(y_test_orig, y_pred_orig)
    plt.figure(figsize=(10, 8))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=class_names, yticklabels=class_names)
    plt.title("Confusion Matrix")
    plt.xlabel("Predicted")
    plt.ylabel("True")
    plt.savefig(f"{output_dir}/confusion_matrix.png")
    plt.close()
    logger.info("Saved confusion matrix plot")

    accuracy = np.sum(y_pred_orig == y_test_orig) / len(y_test_orig)
    logger.info(f"Accuracy: {accuracy:.2%}")

    class_value_to_name_idx = {-1: 0, 0: 1, 1: 2}
    for class_value in [-1, 0, 1]:
        class_indices = (y_pred_orig == class_value)
        if np.sum(class_indices) > 0:
            class_name_idx = class_value_to_name_idx[class_value]
            avg_conf = np.mean(confidences[class_indices])
            logger.info(f"Average confidence for {class_names[class_name_idx]}: {avg_conf:.2%}")

            correct_indices = (y_pred_orig == class_value) & (y_test_orig == class_value)
            incorrect_indices = (y_pred_orig == class_value) & (y_test_orig != class_value)

            if np.sum(correct_indices) > 0:
                avg_correct_conf = np.mean(confidences[correct_indices])
                logger.info(f"  - Average confidence for correct {class_names[class_name_idx]}: {avg_correct_conf:.2%}")

            if np.sum(incorrect_indices) > 0:
                avg_incorrect_conf = np.mean(confidences[incorrect_indices])
                logger.info(f"  - Average confidence for incorrect {class_names[class_name_idx]}: {avg_incorrect_conf:.2%}")

def train_advanced_xgboost_model() -> Tuple[Optional[xgb.Booster], Optional[Dict[int, float]], Optional[List[str]]]:
    try:
        logger.info("Fetching historical candles from Binance...")
        # Fetch data for both BTCUSDT and ETHUSDT
        symbols = ["BTCUSDT", "ETHUSDT"]
        all_raw_data = []
        for symbol in symbols:
            raw = get_ohlcv_from_binance(symbol, limit=20000)
            if not raw:
                logger.error(f"No data retrieved for {symbol} from Binance.")
                continue
            all_raw_data.extend(raw)

        if not all_raw_data:
            logger.error("No data retrieved for any symbol.")
            return None, None, None

        df = pd.DataFrame(all_raw_data)
        if df.empty:
            logger.error("Empty DataFrame after loading data.")
            return None, None, None

        required_columns = ['open', 'high', 'low', 'close', 'volume']
        if not all(col in df.columns for col in required_columns):
            logger.error(f"Missing required columns. Found: {df.columns.tolist()}")
            return None, None, None

        if 'timestamp' in df.columns:
            df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce', utc=True)
            df.set_index('timestamp', inplace=True)
        df.dropna(inplace=True)

        logger.info("Creating advanced features...")
        df_for_features = df.reset_index()
        enriched = df_for_features.to_dict("records")
        X, _ = generate_features_labels(enriched)  # Ignore labels from generate_features_labels

        if isinstance(X, type(None)) or len(X) == 0:
            logger.warning("No features generated from the feature engineering module")
            X = pd.DataFrame(index=df.index[:len(df) - max([3, 5, 8])])

        # Use create_enhanced_labels for better label distribution
        y = create_enhanced_labels(df, threshold_buy=0.0035, threshold_sell=0.0028, lookforward_periods=[3, 5, 8])

        X = add_advanced_features(X, df)

        min_len = min(len(X), len(y))
        X = X.iloc[:min_len]
        y = y[:min_len]

        logger.info(f"Features: {X.shape} | Labels: {len(y)}")

        feature_names = X.columns.tolist()
        logger.info(f"Feature names: {feature_names}")

        unique, counts = np.unique(y, return_counts=True)
        class_dist = dict(zip(unique, counts))
        logger.info(f"Class distribution: {class_dist}")

        min_class_count = min(counts)
        if min_class_count < 5:
            logger.warning(f"Class with few samples detected: {min_class_count}. This may affect model performance.")

        label_mapping = {-1: 0, 0: 1, 1: 2}
        reverse_mapping = {v: k for k, v in label_mapping.items()}
        y_mapped = np.array([label_mapping[label] for label in y])

        scaler = StandardScaler()
        X_scaled = pd.DataFrame(scaler.fit_transform(X), columns=X.columns, index=X.index)

        tscv = TimeSeriesSplit(n_splits=5)
        train_indices = []
        test_indices = []

        for train_idx, test_idx in tscv.split(X_scaled):
            train_indices = train_idx
            test_indices = test_idx

        X_train, X_test = X_scaled.iloc[train_indices], X_scaled.iloc[test_indices]
        y_train, y_test = y_mapped[train_indices], y_mapped[test_indices]

        # Remove stratify to avoid issues with low class counts
        X_val, X_test, y_val, y_test = train_test_split(
            X_test, y_test, test_size=0.5, random_state=42
        )

        logger.info("Applying ADASYN to balance classes...")
        try:
            if min_class_count >= 5:
                adasyn = ADASYN(random_state=42, sampling_strategy='auto')
                X_train_resampled, y_train_resampled = adasyn.fit_resample(X_train, y_train)
            else:
                logger.warning("Skipping ADASYN due to insufficient samples in some classes.")
                X_train_resampled, y_train_resampled = X_train.values, y_train
        except Exception as e:
            logger.error(f"ADASYN failed: {str(e)}, using original data")
            X_train_resampled, y_train_resampled = X_train.values, y_train

        total_samples = sum(counts)
        class_weights = {}
        for label, count in class_dist.items():
            weight = (total_samples / (len(counts) * count)) ** 0.5
            class_weights[label_mapping[label]] = weight

        class_weights[0] *= 1.2
        class_weights[2] *= 1.2
        class_weights[1] *= 0.8
        logger.info(f"Class weights: {class_weights}")

        logger.info("Performing feature selection...")
        base_model = xgb.XGBClassifier(
            n_estimators=100,
            learning_rate=0.1,
            objective='multi:softprob',
            num_class=3,
            random_state=42
        )

        base_model.fit(X_train_resampled, y_train_resampled)
        selection = SelectFromModel(base_model, threshold='median')
        selection.fit(X_train_resampled, y_train_resampled)

        selected_indices = selection.get_support()
        selected_features = [feature_names[i] for i in range(len(feature_names)) if selected_indices[i]]
        logger.info(f"Selected {len(selected_features)} features: {', '.join(selected_features)}")

        X_train_selected = selection.transform(X_train_resampled)
        X_val_selected = selection.transform(X_val)
        X_test_selected = selection.transform(X_test)

        logger.info("Optimizing hyperparameters with Optuna...")
        study = optuna.create_study(direction='maximize')
        study.optimize(
            lambda trial: objective(trial, X_train_selected, y_train_resampled, X_val_selected, y_val, class_weights),
            n_trials=50
        )

        best_params = study.best_params
        best_params.update({
            'objective': 'multi:softprob',
            'num_class': 3,
            'eval_metric': ['mlogloss', 'merror'],
            'seed': 42
        })
        logger.info(f"Best Parameters: {best_params}")

        logger.info("Training final model with optimized parameters...")
        dtrain = xgb.DMatrix(
            X_train_selected,
            label=y_train_resampled,
            weight=[class_weights[y] for y in y_train_resampled]
        )
        dval = xgb.DMatrix(X_val_selected, label=y_val)
        dtest = xgb.DMatrix(X_test_selected, label=y_test)

        watchlist = [(dtrain, 'train'), (dval, 'val')]
        evals_result = {}
        bst = xgb.train(
            params=best_params,
            dtrain=dtrain,
            num_boost_round=10000,
            evals=watchlist,
            early_stopping_rounds=50,
            evals_result=evals_result,
            verbose_eval=100
        )

        output_dir = create_output_directory()

        joblib.dump(feature_names, f"{output_dir}/feature_names.pkl")
        logger.info("Saved feature names")

        with open(f"{output_dir}/selected_features.txt", "w") as f:
            f.write("\n".join(selected_features))
        logger.info("Saved selected features")

        plot_learning_curves(evals_result)
        save_feature_importance(bst, selected_features, output_dir)

        logger.info("Calculating optimal prediction thresholds...")
        optimal_thresholds = calculate_optimal_thresholds(bst, X_val_selected, y_val, reverse_mapping)
        logger.info(f"Optimal thresholds: {optimal_thresholds}")

        logger.info("Evaluating model...")
        y_pred_orig, confidences = predict_with_confidence(bst, X_test_selected, optimal_thresholds, reverse_mapping)
        y_test_orig = np.array([reverse_mapping[t] for t in y_test])

        class_names = ['Sell (-1)', 'Hold (0)', 'Buy (1)']
        print_model_evaluation(y_test_orig, y_pred_orig, confidences, class_names, output_dir)

        joblib.dump(bst, f"{output_dir}/xgboost_model.pkl")
        joblib.dump(scaler, f"{output_dir}/feature_scaler.pkl")
        joblib.dump(selection, f"{output_dir}/feature_selector.pkl")

        with open(f"{output_dir}/optimal_thresholds.txt", "w") as f:
            for k, v in optimal_thresholds.items():
                f.write(f"{k}: {v}\n")

        logger.info(f"All model artifacts saved to directory: {output_dir}")

        return bst, optimal_thresholds, selected_features

    except Exception as e:
        logger.error(f"Training failed: {str(e)}", exc_info=True)
        return None, None, None

if __name__ == "__main__":
    train_advanced_xgboost_model()