from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import joblib
import numpy as np
import os
import traceback

# ---- Paths ----
app_dir      = os.path.dirname(os.path.abspath(__file__))
root_dir     = os.path.dirname(app_dir)
frontend_dir = os.path.join(root_dir, 'frontend')
models_dir   = os.path.join(app_dir, 'models')

app = Flask(__name__, static_folder=frontend_dir, static_url_path='')
CORS(app)

# ---- Globals ----
rf_model        = None
severity_model  = None
encoders        = None
scaler          = None
severity_encoder= None
feat_importance = []   # ordered list matching feature columns
model_metrics   = None

FEATURE_COLS = ['speed', 'time', 'weather', 'road_condition', 'location', 'traffic_density']

def load_resources():
    global rf_model, severity_model, encoders, scaler, severity_encoder, feat_importance, model_metrics
    try:
        rf_model        = joblib.load(os.path.join(models_dir, 'rf_risk_model.joblib'))
        severity_model  = joblib.load(os.path.join(models_dir, 'severity_model.joblib'))
        encoders        = joblib.load(os.path.join(models_dir, 'encoders.joblib'))
        scaler          = joblib.load(os.path.join(models_dir, 'scaler.joblib'))
        severity_encoder= joblib.load(os.path.join(models_dir, 'severity_encoder.joblib'))
        fi_dict         = joblib.load(os.path.join(models_dir, 'feature_importance.joblib'))
        
        try:
            model_metrics = joblib.load(os.path.join(models_dir, 'metrics.joblib'))
        except:
            model_metrics = {"rf": {"accuracy":0, "precision":0, "recall":0, "f1":0}, "mlp": {"accuracy":0, "precision":0, "recall":0, "f1":0}}

        # Keep in FEATURE_COLS order so frontend labels align
        feat_importance = [float(fi_dict.get(c, 0.0)) for c in FEATURE_COLS]
        print(f"[OK] Models loaded | frontend: {frontend_dir}")
    except Exception as e:
        print(f"[ERROR] Loading models: {e}")
        traceback.print_exc()

def preprocess(data):
    """Build feature vector from request dict → scaler → numpy array."""
    row = [
        float(data['speed']),
        float(data['time']),
        int(encoders['weather'].transform([data['weather']])[0]),
        int(encoders['road_condition'].transform([data['road_condition']])[0]),
        int(encoders['location'].transform([data['location']])[0]),
        int(encoders['traffic_density'].transform([data['traffic_density']])[0]),
    ]
    return scaler.transform([row])  # shape (1, 6)

# ---- Routes ----

@app.route('/predict', methods=['POST'])
def predict():
    if rf_model is None or severity_model is None:
        return jsonify({"status": "error", "message": "Models not loaded. Run training first."})
    try:
        body = request.get_json(force=True)
        X = preprocess(body)

        # -- Risk (Random Forest) --
        risk_prob = float(rf_model.predict_proba(X)[0][1])

        # -- Severity (Neural Network MLP) --
        sev_idx   = int(severity_model.predict(X)[0])
        sev_label = str(severity_encoder.inverse_transform([sev_idx])[0])

        # -- Severity trend: vary speed ±50 km/h in steps --
        base_speed = float(body['speed'])
        trend = []
        for i in range(-5, 1):
            X_t = X.copy()
            X_t[0][0] = max(20.0, min(150.0, base_speed + i * 10.0))
            idx = int(severity_model.predict(X_t)[0])
            trend.append(float(idx))

        return jsonify({
            "status":           "success",
            "risk_probability": risk_prob,
            "severity":         sev_label,
            "feature_importance": feat_importance,
            "severity_trend":   trend
        })
    except Exception as e:
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)})

@app.route('/predict-risk', methods=['POST'])
def predict_risk():
    try:
        body = request.get_json(force=True)
        X    = preprocess(body)
        risk = float(rf_model.predict_proba(X)[0][1])
        return jsonify({"status": "success", "risk_probability": risk})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

@app.route('/predict-severity', methods=['POST'])
def predict_severity():
    try:
        body  = request.get_json(force=True)
        X     = preprocess(body)
        idx   = int(severity_model.predict(X)[0])
        label = str(severity_encoder.inverse_transform([idx])[0])
        return jsonify({"status": "success", "severity": label})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

@app.route('/train-model', methods=['POST'])
def train():
    try:
        import sys
        sys.path.insert(0, root_dir)
        from backend.utils.data_generator import generate_dataset
        from backend.utils.trainer import train_models
        generate_dataset()
        train_models()
        load_resources()
        return jsonify({"status": "success", "message": "Models retrained and reloaded."})
    except Exception as e:
        traceback.print_exc()
        return jsonify({"status": "error", "message": str(e)})

@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "models_loaded": rf_model is not None})

@app.route('/metrics', methods=['GET'])
def get_metrics():
    return jsonify({"status": "success", "metrics": model_metrics})

@app.route('/')
def index():
    return send_from_directory(frontend_dir, 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(frontend_dir, path)

if __name__ == '__main__':
    load_resources()
    app.run(host='0.0.0.0', port=5050, debug=False)
