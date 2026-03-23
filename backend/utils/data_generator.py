import pandas as pd
import numpy as np
import os

def generate_dataset(num_samples=2000):
    np.random.seed(42)
    
    # Features
    speed = np.random.uniform(20, 120, num_samples)
    weather_options = ['Sunny', 'Rainy', 'Foggy', 'Snowy']
    weather = np.random.choice(weather_options, num_samples)
    
    road_condition_options = ['Dry', 'Wet', 'Icy', 'Under Maintenance']
    road_condition = np.random.choice(road_condition_options, num_samples)
    
    time_of_day = np.random.randint(0, 24, num_samples)
    
    location_options = ['Urban', 'Rural', 'Highway']
    location = np.random.choice(location_options, num_samples)
    
    traffic_density_options = ['Low', 'Medium', 'High']
    traffic_density = np.random.choice(traffic_density_options, num_samples)
    
    # Target 1: Accident Risk (Probability Logic)
    # Higher speed, worse weather, worse road condition, higher traffic = Higher Risk
    risk_score = (speed / 120) * 0.4
    risk_score += (np.where(np.isin(weather, ['Rainy', 'Foggy', 'Snowy']), 1, 0)) * 0.2
    risk_score += (np.where(np.isin(road_condition, ['Wet', 'Icy', 'Under Maintenance']), 1, 0)) * 0.2
    risk_score += (np.where(traffic_density == 'High', 1, 0)) * 0.2
    
    # Normalize and add noise
    risk_score = risk_score + np.random.normal(0, 0.05, num_samples)
    risk_score = np.clip(risk_score, 0, 1)
    
    # Convert risk_score to binary for training (Risk > 0.5 is 1, else 0)
    accident_risk = (risk_score > 0.5).astype(int)
    
    # Target 2: Accident Severity (Low, Medium, High)
    # Severity depends on speed and location
    severity_val = (speed / 120) * 0.6 + (np.where(location == 'Highway', 1, 0)) * 0.4
    severity_val += np.random.normal(0, 0.1, num_samples)
    
    severity_labels = []
    for val in severity_val:
        if val < 0.33:
            severity_labels.append('Low')
        elif val < 0.66:
            severity_labels.append('Medium')
        else:
            severity_labels.append('High')
            
    # Create DataFrame
    df = pd.DataFrame({
        'speed': speed,
        'weather': weather,
        'road_condition': road_condition,
        'time': time_of_day,
        'location': location,
        'traffic_density': traffic_density,
        'accident_risk': accident_risk,
        'accident_severity': severity_labels
    })
    
    # Ensure sequential nature for LSTM (Severity Trends)
    # We'll just sort by time for the sake of "trend" demonstration if it's a single time series
    # But usually, LSTM needs time steps. Let's assume we have blocks of time steps for each location.
    # For this synthetic dataset, we'll keep it simple: 1 row = 1 observation.
    # For LSTM, we'll group and create sequences during training.
    
    output_path = os.path.join(os.getcwd(), 'backend', 'dataset', 'road_accidents.csv')
    df.to_csv(output_path, index=False)
    print(f"Dataset generated at {output_path}")

if __name__ == "__main__":
    generate_dataset()
