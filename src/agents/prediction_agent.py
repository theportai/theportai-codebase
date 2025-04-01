import joblib
import os
import pandas as pd

class PredictionAgent:
    def __init__(self):
        model_path = "src/ml/prediction_model.pkl"
        if not os.path.exists(model_path):
            print("❌ prediction_model.pkl not found. Defaulting to rule-based logic.")
            self.model = None
        else:
            self.model = joblib.load(model_path)

    def analyze(self, features_row):
        if self.model is None:
            return "hold"

        prediction = self.model.predict(features_row)[0]

        if prediction == 1:
            return "buy"
        elif prediction == -1:
            return "sell"
        return "hold"