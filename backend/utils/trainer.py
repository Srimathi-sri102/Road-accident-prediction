import pandas as pd
import numpy as np
import os
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score

def train_models():
    data_path = os.path.join(os.getcwd(), 'backend', 'dataset', 'road_accidents.csv')
    if not os.path.exists(data_path):
        from backend.utils.data_generator import generate_dataset
        generate_dataset()
        
    df = pd.read_csv(data_path)

    # Encode categorical features
    categorical_cols = ['weather', 'road_condition', 'location', 'traffic_density']
    
    encoders = {}
    for col in categorical_cols:
        le = LabelEncoder()
        df[col] = le.fit_transform(df[col])
        encoders[col] = le
        
    # Standardize numerical features
    scaler = StandardScaler()
    X_numeric = df[['speed', 'time'] + categorical_cols]
    X_scaled = scaler.fit_transform(X_numeric)
    
    # Save encoders and scaler
    os.makedirs('backend/models', exist_ok=True)
    joblib.dump(encoders, 'backend/models/encoders.joblib')
    joblib.dump(scaler, 'backend/models/scaler.joblib')

    # Train Random Forest (Accident Risk)
    y_risk = df['accident_risk']
    X_train_rf, X_test_rf, y_train_rf, y_test_rf = train_test_split(X_scaled, y_risk, test_size=0.2, random_state=42)
    
    rf_model = RandomForestClassifier(n_estimators=100, random_state=42)
    rf_model.fit(X_train_rf, y_train_rf)
    
    # Feature Importance
    feature_importance = dict(zip(['speed', 'time'] + categorical_cols, rf_model.feature_importances_))
    joblib.dump(feature_importance, 'backend/models/feature_importance.joblib')
    joblib.dump(rf_model, 'backend/models/rf_risk_model.joblib')
    print("Random Forest model trained and saved.")

    # Train MLP Classifier (Simulating Severity Deep Learning as fallback for LSTM on 3.14)
    severity_le = LabelEncoder()
    y_severity = severity_le.fit_transform(df['accident_severity'])
    joblib.dump(severity_le, 'backend/models/severity_encoder.joblib')
    
    X_train_sev, X_test_sev, y_train_sev, y_test_sev = train_test_split(X_scaled, y_severity, test_size=0.2, random_state=42)
    
    # Using MLPClassifier for deep neural network representation
    mlp_model = MLPClassifier(hidden_layer_sizes=(64, 32), max_iter=500, alpha=1e-4,
                        solver='adam', verbose=0, random_state=42,
                        learning_rate_init=.01)
                        
    mlp_model.fit(X_train_sev, y_train_sev)
    
    # Save MLP Model as the "Severity" model
    joblib.dump(mlp_model, 'backend/models/severity_model.joblib')
    print("Severity model (Neural Network) trained and saved.")

    # ------ CALCULATE METRICS FOR FYP DASHBOARD ------
    rf_preds = rf_model.predict(X_test_rf)
    mlp_preds = mlp_model.predict(X_test_sev)

    metrics = {
        "rf": {
            "accuracy": accuracy_score(y_test_rf, rf_preds),
            "precision": precision_score(y_test_rf, rf_preds, average='macro', zero_division=0),
            "recall": recall_score(y_test_rf, rf_preds, average='macro', zero_division=0),
            "f1": f1_score(y_test_rf, rf_preds, average='macro', zero_division=0)
        },
        "mlp": {
            "accuracy": accuracy_score(y_test_sev, mlp_preds),
            "precision": precision_score(y_test_sev, mlp_preds, average='weighted', zero_division=0),
            "recall": recall_score(y_test_sev, mlp_preds, average='weighted', zero_division=0),
            "f1": f1_score(y_test_sev, mlp_preds, average='weighted', zero_division=0)
        }
    }
    joblib.dump(metrics, 'backend/models/metrics.joblib')
    print("Model metrics calculated and saved.")

if __name__ == "__main__":
    train_models()
