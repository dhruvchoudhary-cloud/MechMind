import os
import json
import numpy as np
import pandas as pd
from pathlib import Path
import sklearn
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.ensemble import IsolationForest
import joblib

FEATURE_NAMES = ["temperature_c", "vibration_mm_s_rms", "current_a", "rpm"]

def generate_normal_data(n_samples_per_motor: int = 3000, random_seed: int = 42) -> pd.DataFrame:
    """
    Generates synthetic baseline telemetry across all industrial motor profiles in the fleet:
    1. motor-001 (Induction Motor): 56.0°C, 2.1 mm/s, 9.2 A, 1485 RPM
    2. motor-002 (Continuous Duty): 51.5°C, 1.8 mm/s, 7.4 A, 1440 RPM
    3. motor-003 (Centrifugal Pump): 49.0°C, 2.3 mm/s, 11.2 A, 1750 RPM
    """
    np.random.seed(random_seed)
    profiles = [
        {"base_temp": 56.0, "base_vib": 2.1, "base_curr": 9.2, "base_rpm": 1485.0},
        {"base_temp": 51.5, "base_vib": 1.8, "base_curr": 7.4, "base_rpm": 1440.0},
        {"base_temp": 49.0, "base_vib": 2.3, "base_curr": 11.2, "base_rpm": 1750.0},
    ]

    all_dfs = []
    for p in profiles:
        t = np.linspace(0, 100, n_samples_per_motor)
        temp = p["base_temp"] + 2.0 * np.sin(0.05 * t) + np.random.normal(0, 1.2, n_samples_per_motor)
        vibration = p["base_vib"] + 0.15 * np.sin(0.1 * t) + np.random.normal(0, 0.25, n_samples_per_motor)
        current = p["base_curr"] + 0.4 * np.sin(0.05 * t) + np.random.normal(0, 0.4, n_samples_per_motor)
        rpm = p["base_rpm"] + np.random.normal(0, 15.0, n_samples_per_motor)

        df_motor = pd.DataFrame({
            "temperature_c": np.round(temp, 2),
            "vibration_mm_s_rms": np.round(vibration, 3),
            "current_a": np.round(current, 2),
            "rpm": np.round(rpm, 1)
        })
        all_dfs.append(df_motor)

    return pd.concat(all_dfs, ignore_index=True)

def train_and_save_model():
    base_dir = Path(__file__).resolve().parent
    artifacts_dir = base_dir / "artifacts"
    artifacts_dir.mkdir(parents=True, exist_ok=True)
    
    print(f"[ML] Training with scikit-learn {sklearn.__version__}...")
    df = generate_normal_data(n_samples_per_motor=3000, random_seed=42)
    X = df[FEATURE_NAMES].values
    
    # Construct complete pipeline with preprocessing (StandardScaler + IsolationForest)
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("model", IsolationForest(
            n_estimators=100,
            max_samples="auto",
            contamination=0.01,
            random_state=42,
            n_jobs=-1
        ))
    ])
    
    pipeline.fit(X)
    
    artifact_path = artifacts_dir / "isolation_forest_v1.joblib"
    
    # Save model pipeline bundle with metadata
    bundle = {
        "pipeline": pipeline,
        "feature_names": FEATURE_NAMES,
        "sklearn_version": sklearn.__version__,
        "model_version": "iforest-v1.0",
        "description": "Unsupervised Isolation Forest anomaly detector trained on normal industrial baseline data."
    }
    joblib.dump(bundle, artifact_path)
    print(f"[ML] Successfully saved pipeline bundle artifact to {artifact_path}")
    
    # Save human-readable training metadata JSON (Issue 1, 11, 13)
    meta = {
        "model_name": "StandardScaler + IsolationForest",
        "model_version": "iforest-v1.0",
        "sklearn_version": sklearn.__version__,
        "features": FEATURE_NAMES,
        "n_samples": len(df),
        "contamination": 0.03,
        "random_state": 42,
        "disclaimer": "Unsupervised anomaly detection identifies observations that deviate from normal multivariate operational distribution. It does not output a calibrated probability of failure or remaining useful life (RUL).",
        "normal_stats": {
            col: {
                "mean": float(df[col].mean()),
                "std": float(df[col].std()),
                "min": float(df[col].min()),
                "max": float(df[col].max())
            } for col in FEATURE_NAMES
        }
    }
    with open(artifacts_dir / "model_metadata.json", "w") as f:
        json.dump(meta, f, indent=2)
    
    print("[ML] Training metadata saved.")

if __name__ == "__main__":
    train_and_save_model()
