import pandas as pd # type: ignore
import numpy as np # type: ignore
import joblib # type: ignore
from sklearn.preprocessing import StandardScaler # type: ignore
from sklearn.model_selection import train_test_split, TimeSeriesSplit # type: ignore
from sklearn.metrics import classification_report, confusion_matrix, f1_score, precision_recall_curve # type: ignore
import xgboost as xgb # type: ignore
import matplotlib.pyplot as plt # type: ignore
import seaborn as sns # type: ignore
from imblearn.over_sampling import ADASYN # type: ignore
from sklearn.feature_selection import SelectFromModel # type: ignore
import optuna # type: ignore
from datetime import datetime
import os

from src.data.postgres_ohlcv_loader import get_ohlcv_from_db
from src.ml.feature_engineering import generate_features_labels


def create_enhanced_labels(df, threshold_buy=0.0035, threshold_sell=0.0028, lookforward_periods=[3, 5, 8]):
    """
    Create enhanced multi-timeframe labels using multiple lookforward periods and averaging
    This creates more robust signals by ensuring patterns persist
    """
    all_labels = []
    
    for period in lookforward_periods:
        period_labels = []
        for i in range(len(df) - max(lookforward_periods)):
            future_price = df.iloc[i + period]["close"]
            current_price = df.iloc[i]["close"]
            change = (future_price - current_price) / current_price
            
            if change > threshold_buy:
                period_labels.append(1)  # Buy
            elif change < -threshold_sell:
                period_labels.append(-1)  # Sell
            else:
                period_labels.append(0)  # Hold
        
        # Padding with zeros
        period_labels.extend([0] * (len(df) - len(period_labels)))
        all_labels.append(period_labels)
    
    # Convert to numpy arrays for easier manipulation
    all_labels = np.array(all_labels)
    
    # Take majority vote across timeframes (more robust signal)
    final_labels = []
    for i in range(all_labels.shape[1]):
        votes = all_labels[:, i]
        # If any timeframe strongly suggests buy/sell, go with it
        if 1 in votes and -1 not in votes:
            final_labels.append(1)
        elif -1 in votes and 1 not in votes:
            final_labels.append(-1)
        # If conflicting signals, go with majority
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
    
    return final_labels


def add_advanced_features(X, df):
    """Add comprehensive market-specific features for better prediction"""
    # Make sure X has the same index as df
    X = pd.DataFrame(X)
    X.index = df.index[:len(X)]
    
    # Market structure features
    X['trend_strength'] = abs(df['close'].rolling(50).mean() - df['close'].rolling(200).mean()) / df['close'].rolling(50).std()
    
    # Volatility features
    X['atr_14'] = df['high'].rolling(14).max() - df['low'].rolling(14).min()
    X['volatility_14'] = df['close'].rolling(14).std()
    X['volatility_ratio'] = df['close'].rolling(5).std() / df['close'].rolling(20).std()
    
    # Momentum features
    X['rsi_14'] = calculate_rsi(df['close'], 14)
    X['macd'] = calculate_macd(df['close'])
    X['price_momentum'] = df['close'].pct_change(5) + df['close'].pct_change(10) + df['close'].pct_change(20)
    
    # Volume features
    X['volume_change'] = df['volume'].pct_change()
    X['volume_ma_ratio'] = df['volume'] / df['volume'].rolling(20).mean()
    X['volume_price_trend'] = (df['close'] - df['close'].shift(1)) * df['volume']
    X['volume_divergence'] = (df['volume'].rolling(5).mean() / df['volume'].rolling(20).mean()) - (df['close'].rolling(5).mean() / df['close'].rolling(20).mean())
    
    # Price action features
    X['body_size'] = abs(df['close'] - df['open']) / (df['high'] - df['low'])
    X['upper_shadow'] = (df['high'] - df[['open', 'close']].max(axis=1)) / (df['high'] - df['low'])
    X['lower_shadow'] = (df[['open', 'close']].min(axis=1) - df['low']) / (df['high'] - df['low'])
    X['close_position'] = (df['close'] - df['low']) / (df['high'] - df['low'])
    
    # Market regime features
    X['price_sma_ratio'] = df['close'] / df['close'].rolling(50).mean()
    X['bollinger_position'] = (df['close'] - df['close'].rolling(20).mean()) / (df['close'].rolling(20).std() * 2)
    X['bb_width'] = (df['close'].rolling(20).mean() + 2*df['close'].rolling(20).std() - 
                   (df['close'].rolling(20).mean() - 2*df['close'].rolling(20).std())) / df['close'].rolling(20).mean()
    
    # Support/Resistance proximity indicators
    proximity = calculate_pivot_proximity(df)
    # Make sure the pivot_proximity has the same length as X
    X['pivot_proximity'] = proximity[:len(X)]
    
    # Trend direction features
    sma_20 = df['close'].rolling(20).mean()
    sma_50 = df['close'].rolling(50).mean()
    sma_200 = df['close'].rolling(200).mean()
    X['sma_20_50_cross'] = (sma_20 > sma_50).astype(int) * 2 - 1  # +1 if 20 above 50, -1 if below
    X['sma_50_200_cross'] = (sma_50 > sma_200).astype(int) * 2 - 1  # +1 if 50 above 200, -1 if below
    
    # Time-based features
    if 'timestamp' in df.columns:
        try:
            # First try to convert assuming it's milliseconds since epoch
            df['datetime'] = pd.to_datetime(df['timestamp'], unit='ms', errors='coerce')
            
            # If we got NaT values, try parsing as date strings without specifying unit
            if df['datetime'].isna().any():
                df['datetime'] = pd.to_datetime(df['timestamp'], errors='coerce')
                
            # Extract time features if conversion was successful
            if not df['datetime'].isna().all():
                X['hour'] = df['datetime'].dt.hour[:len(X)]
                X['day_of_week'] = df['datetime'].dt.dayofweek[:len(X)]
        except Exception as e:
            print(f"Warning: Could not convert timestamps to datetime: {e}")
    
    # Fill NaN values
    X.fillna(method='bfill', inplace=True)
    X.fillna(0, inplace=True)
    return X


def calculate_rsi(prices, period=14):
    """Calculate RSI indicator"""
    delta = prices.diff()
    gain = delta.where(delta > 0, 0).rolling(window=period).mean()
    loss = -delta.where(delta < 0, 0).rolling(window=period).mean()
    
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi


def calculate_macd(prices, fast=12, slow=26, signal=9):
    """Calculate MACD indicator"""
    ema_fast = prices.ewm(span=fast, adjust=False).mean()
    ema_slow = prices.ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    return macd_line - signal_line


def calculate_pivot_proximity(df, window=20):
    """Calculate proximity to support/resistance levels"""
    pivot_high = df['high'].rolling(window, center=True).apply(lambda x: x[len(x)//2] == max(x), raw=True).fillna(0)
    pivot_low = df['low'].rolling(window, center=True).apply(lambda x: x[len(x)//2] == min(x), raw=True).fillna(0)
    
    proximity = np.zeros(len(df))
    
    for i in range(len(df)):
        # Look back for recent pivots
        look_back = 100
        start_idx = max(0, i-look_back)
        
        recent_highs = []
        recent_lows = []
        
        for j in range(start_idx, i):
            if j < len(pivot_high) and pivot_high.iloc[j] > 0:
                recent_highs.append(df['high'].iloc[j])
            if j < len(pivot_low) and pivot_low.iloc[j] > 0:
                recent_lows.append(df['low'].iloc[j])
        
        if not recent_highs and not recent_lows:
            continue
            
        # Calculate proximity to nearest level
        price = df['close'].iloc[i]
        
        nearest_distance = float('inf')
        for level in recent_highs + recent_lows:
            distance = abs(price - level) / price
            if distance < nearest_distance:
                nearest_distance = distance
        
        # Convert to a 0-1 score (closer = higher)
        proximity[i] = 1 - min(nearest_distance * 100, 1)
    
    return proximity


def objective(trial, X_train, y_train, X_test, y_test, class_weights):
    """Optuna objective function for hyperparameter optimization"""
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
    
    # Create sample weights for imbalanced classes
    sample_weights = np.array([class_weights[y] for y in y_train])
    
    # Training data
    dtrain = xgb.DMatrix(X_train, label=y_train, weight=sample_weights)
    dtest = xgb.DMatrix(X_test, label=y_test)
    
    # Train with early stopping
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
    
    # Get predictions for test set
    y_pred_probs = bst.predict(dtest)
    y_pred = np.argmax(y_pred_probs, axis=1)
    
    # Create custom scoring function that prioritizes buy/sell recall
    buy_sell_recall = 0
    precision = 0
    
    # Calculate recall for buy and sell classes specifically
    y_test_np = np.array(y_test)
    for target_class in [0, 2]:  # Buy and Sell classes (0 is Sell, 2 is Buy)
        class_indices = y_test_np == target_class
        if np.sum(class_indices) > 0:
            recall = np.sum((y_pred == target_class) & class_indices) / np.sum(class_indices)
            buy_sell_recall += recall
    
    buy_sell_recall /= 2  # Average of Buy and Sell recall
    
    # Calculate weighted F1 score for all classes
    f1 = f1_score(y_test, y_pred, average='weighted')
    
    # Combined score with emphasis on buy/sell recall
    final_score = (buy_sell_recall * 0.7) + (f1 * 0.3)
    
    return final_score


def calculate_optimal_thresholds(model, X_val, y_val, reverse_mapping):
    """Calculate optimal prediction thresholds to maximize F1 score for each class"""
    dval = xgb.DMatrix(X_val)
    y_pred_probs = model.predict(dval)
    
    thresholds = {}
    
    # For each class
    for class_idx in range(3):  # 0: Sell, 1: Hold, 2: Buy
        # One-vs-rest approach
        y_true_binary = (y_val == class_idx).astype(int)
        y_scores = y_pred_probs[:, class_idx]
        
        # Calculate precision-recall curve
        precision, recall, thresholds_pr = precision_recall_curve(y_true_binary, y_scores)
        
        # Calculate F1 score for each threshold
        f1_scores = 2 * recall * precision / (recall + precision + 1e-10)  # avoid div by zero
        
        # Find threshold with max F1 score
        best_idx = np.argmax(f1_scores)
        if len(thresholds_pr) > best_idx:
            best_threshold = thresholds_pr[best_idx]
        else:
            best_threshold = 0.5  # default fallback
        
        thresholds[reverse_mapping[class_idx]] = best_threshold
    
    return thresholds


def predict_with_confidence(model, X, optimal_thresholds, reverse_mapping):
    """Make predictions with confidence thresholds"""
    dmatrix = xgb.DMatrix(X)
    probs = model.predict(dmatrix)
    
    predictions = []
    confidences = []
    
    for i in range(len(X)):
        class_probs = probs[i]
        max_class = np.argmax(class_probs)
        max_prob = class_probs[max_class]
        
        # Map back to original labels
        orig_label = reverse_mapping[max_class]
        
        # Check if probability exceeds the optimal threshold
        threshold = optimal_thresholds[orig_label]
        
        if max_prob >= threshold:
            predictions.append(orig_label)
            confidences.append(max_prob)
        else:
            # If below threshold, predict 'Hold' with low confidence
            predictions.append(0)  # Hold
            confidences.append(max_prob)
    
    return np.array(predictions), np.array(confidences)


def plot_learning_curves(evals_result):
    """Plot detailed learning curves from training"""
    if not evals_result:
        return
    
    metrics = []
    if 'mlogloss' in evals_result['train']:
        metrics.append('mlogloss')
    if 'merror' in evals_result['train']:
        metrics.append('merror')
    
    if not metrics:
        return
        
    n_metrics = len(metrics)
    fig, axes = plt.subplots(1, n_metrics, figsize=(6*n_metrics, 5))
    
    if n_metrics == 1:
        axes = [axes]
    
    # Find validation set key - could be 'test', 'val', or 'validation'
    val_key = None
    for possible_key in ['val', 'test', 'validation']:
        if possible_key in evals_result:
            val_key = possible_key
            break
    
    # If no validation key found, just plot training data
    if val_key is None:
        print("Warning: No validation results found in evals_result")
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

def create_output_directory():
    """Create an output directory with timestamp for model artifacts"""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir = f"model_artifacts_{timestamp}"
    os.makedirs(output_dir, exist_ok=True)
    return output_dir


def save_feature_importance(model, feature_names, output_dir):
    """Save detailed feature importance analysis"""
    # Get feature importance
    importance_types = ['weight', 'gain', 'cover', 'total_gain', 'total_cover']
    
    for imp_type in importance_types:
        try:
            # Get feature importance
            importance = model.get_score(importance_type=imp_type)
            
            # Create dataframe
            imp_df = pd.DataFrame({
                'Feature': list(importance.keys()),
                'Importance': list(importance.values())
            }).sort_values('Importance', ascending=False)
            
            # Plot
            plt.figure(figsize=(10, max(8, len(imp_df) * 0.3)))
            sns.barplot(x='Importance', y='Feature', data=imp_df)
            plt.title(f"Feature Importance ({imp_type})")
            plt.tight_layout()
            plt.savefig(f"{output_dir}/feature_importance_{imp_type}.png")
            plt.close()
            
            # Save to CSV
            imp_df.to_csv(f"{output_dir}/feature_importance_{imp_type}.csv", index=False)
        except:
            continue  # Skip if this importance type is not available


def print_model_evaluation(y_test_orig, y_pred_orig, confidences, class_names, output_dir):
    """Print comprehensive model evaluation metrics"""
    # Classification report
    report = classification_report(y_test_orig, y_pred_orig, output_dict=True)
    report_df = pd.DataFrame(report).transpose()
    
    # Save report to file
    report_df.to_csv(f"{output_dir}/classification_report.csv")
    
    # Print summary
    print("🎯 Classification Report:\n")
    print(classification_report(y_test_orig, y_pred_orig))
    
    # Confusion matrix
    cm = confusion_matrix(y_test_orig, y_pred_orig)
    plt.figure(figsize=(10, 8))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=class_names, yticklabels=class_names)
    plt.title("Confusion Matrix")
    plt.xlabel("Predicted")
    plt.ylabel("True")
    plt.savefig(f"{output_dir}/confusion_matrix.png")
    plt.close()
    
    # Calculate accuracy
    accuracy = np.sum(y_pred_orig == y_test_orig) / len(y_test_orig)
    print(f"🔴 Accuracy: {accuracy:.2%}")
    
    # Create a mapping from class values to class name indices
    # Since your class values are -1, 0, 1 and class names are ['Sell (-1)', 'Hold (0)', 'Buy (1)']
    class_value_to_name_idx = {
        -1: 0,  # -1 (Sell) maps to index 0
        0: 1,   # 0 (Hold) maps to index 1
        1: 2    # 1 (Buy) maps to index 2
    }
    
    # Calculate average confidence by class
    for class_value in [-1, 0, 1]:
        class_indices = (y_pred_orig == class_value)
        if np.sum(class_indices) > 0:
            class_name_idx = class_value_to_name_idx[class_value]
            avg_conf = np.mean(confidences[class_indices])
            print(f"Average confidence for {class_names[class_name_idx]}: {avg_conf:.2%}")
            
            # Correct vs incorrect predictions by class
            correct_indices = (y_pred_orig == class_value) & (y_test_orig == class_value)
            incorrect_indices = (y_pred_orig == class_value) & (y_test_orig != class_value)
            
            if np.sum(correct_indices) > 0:
                avg_correct_conf = np.mean(confidences[correct_indices])
                print(f"  - Average confidence for correct {class_names[class_name_idx]}: {avg_correct_conf:.2%}")
            
            if np.sum(incorrect_indices) > 0:
                avg_incorrect_conf = np.mean(confidences[incorrect_indices])
                print(f"  - Average confidence for incorrect {class_names[class_name_idx]}: {avg_incorrect_conf:.2%}")


def train_advanced_xgboost_model():
    """Train an advanced XGBoost model with comprehensive optimizations"""
    print("📥 Fetching historical candles...")
    raw = get_ohlcv_from_db("BTCUSDT", limit=20000)  # Increased data size for better training
    df = pd.DataFrame(raw)
    df.dropna(inplace=True)

    print("🧠 Creating advanced features...")
    enriched = df.to_dict("records")
    X, y = generate_features_labels(enriched)
    
    # Check if features were generated properly
    if isinstance(X, type(None)) or len(X) == 0:
        print("⚠️ Warning: No features generated from the feature engineering module")
        X = pd.DataFrame(index=df.index[:len(df)-max([3, 5, 8])])  # Create empty DataFrame with proper index
    
    # Create enhanced multi-timeframe labels
    if isinstance(y, type(None)) or len(y) == 0:
        y = create_enhanced_labels(df, 
                                  threshold_buy=0.0035, 
                                  threshold_sell=0.0028, 
                                  lookforward_periods=[3, 5, 8])

    # Add advanced technical features
    X = add_advanced_features(X, df)

    # Ensure X and y have the same length
    min_len = min(len(X), len(y))
    X = X.iloc[:min_len]
    y = y[:min_len]

    print(f"📊 Features: {X.shape} | Labels: {len(y)}")
    
    # Print class distribution
    unique, counts = np.unique(y, return_counts=True)
    class_dist = dict(zip(unique, counts))
    print("Class distribution:", class_dist)

    # Map labels for multi-class classification
    label_mapping = {-1: 0, 0: 1, 1: 2}  # -1 (Sell) -> 0, 0 (Hold) -> 1, 1 (Buy) -> 2
    reverse_mapping = {v: k for k, v in label_mapping.items()}
    y_mapped = np.array([label_mapping[label] for label in y])

    # Scale features
    scaler = StandardScaler()
    X_scaled = pd.DataFrame(scaler.fit_transform(X), columns=X.columns)

    # Use TimeSeriesSplit for proper time-series validation
    tscv = TimeSeriesSplit(n_splits=5)
    
    # Get the last split for final evaluation
    train_indices = []
    test_indices = []
    
    for train_idx, test_idx in tscv.split(X_scaled):
        train_indices = train_idx
        test_indices = test_idx
    
    # Split data using time series split
    X_train, X_test = X_scaled.iloc[train_indices], X_scaled.iloc[test_indices]
    y_train, y_test = y_mapped[train_indices], y_mapped[test_indices]
    
    # Further split test set into validation and test
    X_val, X_test, y_val, y_test = train_test_split(X_test, y_test, test_size=0.5, random_state=42, stratify=y_test)

    # Apply ADASYN to handle class imbalance (better than SMOTE for boundary cases)
    print("🔄 Applying ADASYN to balance classes...")
    try:
        adasyn = ADASYN(random_state=42, sampling_strategy='auto')
        X_train_resampled, y_train_resampled = adasyn.fit_resample(X_train, y_train)
    except Exception as e:
        # Fallback if ADASYN fails (e.g., too few samples)
        print(f"⚠️ ADASYN failed: {e}, using original data")
        X_train_resampled, y_train_resampled = X_train.values, y_train
    
    # Calculate class weights based on distribution
    total_samples = sum(counts)
    max_class_count = max(counts)
    
    # Define class weights to address imbalance (inverse frequency with smoothing)
    class_weights = {}
    for label, count in class_dist.items():
        weight = (total_samples / (len(counts) * count)) ** 0.5  # Square root for smoothing
        class_weights[label_mapping[label]] = weight
    
    # Ensure higher weights for Buy/Sell vs Hold
    avg_weight = sum(class_weights.values()) / len(class_weights)
    class_weights[0] *= 1.2  # Sell
    class_weights[2] *= 1.2  # Buy
    class_weights[1] *= 0.8  # Hold
    
    print("Class weights:", class_weights)
    
    # Feature selection
    print("🔍 Performing feature selection...")
    base_model = xgb.XGBClassifier(
        n_estimators=100, 
        learning_rate=0.1,
        use_label_encoder=False, 
        objective='multi:softprob',
        num_class=3
    )
    
    base_model.fit(X_train_resampled, y_train_resampled)
    
    # Select important features
    selection = SelectFromModel(base_model, threshold='median')
    selection.fit(X_train_resampled, y_train_resampled)
    
    # Get selected features
    selected_indices = selection.get_support()
    selected_features = X.columns[selected_indices].tolist()
    
    # Apply feature selection
    X_train_selected = selection.transform(X_train_resampled)
    X_val_selected = selection.transform(X_val)
    X_test_selected = selection.transform(X_test)
    
    print(f"Selected {len(selected_features)} features: {', '.join(selected_features)}")

    # Optimize hyperparameters with Optuna
    print("🔍 Optimizing hyperparameters with Optuna...")
    study = optuna.create_study(direction='maximize')
    study.optimize(lambda trial: objective(trial, 
                                          X_train_selected, 
                                          y_train_resampled, 
                                          X_val_selected, 
                                          y_val,
                                          class_weights), 
                   n_trials=50)
    
    best_params = study.best_params
    best_params.update({
        'objective': 'multi:softprob',
        'num_class': 3,
        'eval_metric': ['mlogloss', 'merror'],
        'seed': 42
    })
    
    print("✅ Best Parameters:", best_params)

    # Train final model with best parameters
    print("🏋️ Training final model with optimized parameters...")
    
    # Training data
    dtrain = xgb.DMatrix(X_train_selected, label=y_train_resampled, 
                         weight=[class_weights[y] for y in y_train_resampled])
    dval = xgb.DMatrix(X_val_selected, label=y_val)
    dtest = xgb.DMatrix(X_test_selected, label=y_test)
    
    # Prepare watchlist for evaluation
    watchlist = [(dtrain, 'train'), (dval, 'val')]
    
    # Train using the lower-level API
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
    
    # Create output directory for artifacts
    output_dir = create_output_directory()
    
    # Plot learning curves
    plot_learning_curves(evals_result)
    
    # Save feature importance analysis
    save_feature_importance(bst, selected_features, output_dir)

    # Calculate optimal thresholds for confident predictions
    print("🎯 Calculating optimal prediction thresholds...")
    optimal_thresholds = calculate_optimal_thresholds(bst, X_val_selected, y_val, reverse_mapping)
    print("Optimal thresholds:", optimal_thresholds)
    
    # Make predictions with confidence
    print("📏 Evaluating model...")
    y_pred_orig, confidences = predict_with_confidence(bst, X_test_selected, optimal_thresholds, reverse_mapping)
    y_test_orig = np.array([reverse_mapping[t] for t in y_test])
    
    # Print comprehensive evaluation
    class_names = ['Sell (-1)', 'Hold (0)', 'Buy (1)']
    print_model_evaluation(y_test_orig, y_pred_orig, confidences, class_names, output_dir)
    
    # Save model artifacts
    joblib.dump(bst, f"{output_dir}/xgboost_model.pkl")
    joblib.dump(scaler, f"{output_dir}/feature_scaler.pkl")
    joblib.dump(selection, f"{output_dir}/feature_selector.pkl")
    
    # Save optimal thresholds
    with open(f"{output_dir}/optimal_thresholds.txt", "w") as f:
        for k, v in optimal_thresholds.items():
            f.write(f"{k}: {v}\n")
    
    # Save selected features list
    with open(f"{output_dir}/selected_features.txt", "w") as f:
        f.write("\n".join(selected_features))
    
    print(f"✅ All model artifacts saved to directory: {output_dir}")
    
    return bst, optimal_thresholds, selected_features


if __name__ == "__main__":
    train_advanced_xgboost_model()