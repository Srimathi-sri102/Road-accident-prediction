# RoadSafe AI | Accident Risk & Severity Prediction

A full-stack Machine Learning application that uses **Random Forest** for risk probability and **LSTM (Long Short-Term Memory)** for accident severity forecasting.

## Features:
- **Risk Assessment:** Real-time percentage of accident risk based on 6 environmental features.
- **Severity Forecast:** Categorical prediction (Low, Medium, High) using deep learning.
- **Interactive Map:** Leaflet-based dark map with accident hotspots and traffic density zones.
- **Live Search:** Search locations to auto-sync with the prediction simulation.
- **Explainability:** Dynamic feature importance visualization.
- **Trend Analysis:** Projected severity trend line.
- **Responsive Dashboard:** Modern dark-theme glassmorphism UI with utility tools (Export, Theme toggle).

## Tech Stack:
- **Frontend:** Vanilla HTML5, CSS3, JavaScript, Chart.js.
- **Backend:** Python, Flask, Flask-CORS.
- **Models:** Scikit-learn (Random Forest), TensorFlow/Keras (LSTM), Joblib.

## Setup Instructions:

### 1. Install Dependencies:
```bash
pip install -r requirements.txt
```

### 2. Generate Dataset & Train Models:
First run:
```bash
python backend/utils/data_generator.py
python backend/utils/trainer.py
```

### 3. Run Backend Server:
```bash
python backend/app.py
```

### 4. Access UI:
Open `frontend/index.html` in your browser.

## Project Structure:
- `backend/models/`: Saved model files.
- `backend/dataset/`: Training data.
- `backend/utils/`: Logic for data generation and training.
- `frontend/`: UI files.
