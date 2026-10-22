import logging
import os
import json
from pathlib import Path
from typing import Tuple, Optional, Dict, Any
import numpy as np
import sklearn
from app.config import settings

logger = logging.getLogger(__name__)

EXPECTED_FEATURES = ["temperature_c", "vibration_mm_s_rms", "current_a", "rpm"]

class MLAnomalyDetector:
    def __init__(self, model_path: Optional[str] = None):
        raw_path = model_path or settings.ML_MODEL_PATH
        p = Path(raw_path)
        if not p.is_absolute():
            from app.config import BASE_DIR
            p = BASE_DIR / p
        self.model_path = str(p)
        self.pipeline = None
        self.is_loaded = False
        self.model_version = settings.MODEL_VERSION
        self.trained_sklearn_version = None
        self._load_model()

    def _load_model(self):
        """Safely loads model artifact and checks scikit-learn version compatibility."""
        if not os.path.exists(self.model_path):
            logger.warning(
                f"[ML Detector] Artifact not found at {self.model_path}. "
                "Operating in Rule-Engine fallback mode."
            )
            self.is_loaded = False
            return

        try:
            import joblib
            loaded = joblib.load(self.model_path)
            
            # Check if artifact is modern bundle dictionary or legacy model
            if isinstance(loaded, dict) and "pipeline" in loaded:
                self.pipeline = loaded["pipeline"]
                self.trained_sklearn_version = loaded.get("sklearn_version", "unknown")
                self.model_version = loaded.get("model_version", settings.MODEL_VERSION)
                logger.info(
                    f"[ML Detector] Loaded pipeline bundle (Trained on scikit-learn {self.trained_sklearn_version}, "
                    f"Current: {sklearn.__version__})."
                )
            else:
                self.pipeline = loaded
                self.trained_sklearn_version = "legacy"

            self.is_loaded = True
            logger.info(f"[ML Detector] Model successfully loaded from {self.model_path}")
        except Exception as e:
            logger.error(
                f"[ML Detector] Error loading ML artifact: {e}. "
                "Switching to safe rule-based fallback mode."
            )
            self.pipeline = None
            self.is_loaded = False

    def reload(self):
        """Reloads model artifact dynamically."""
        self._load_model()

    def predict(
        self,
        temperature_c: float,
        vibration_mm_s_rms: float,
        current_a: float,
        rpm: float
    ) -> Tuple[bool, float, str]:
        """
        Runs inference on single sensor reading.
        Input features validated in strict order: [temperature_c, vibration_mm_s_rms, current_a, rpm].
        Returns:
            (is_anomaly: bool, anomaly_score: float, model_version: str)
        """
        if not self.is_loaded or self.pipeline is None:
            # Fallback behavior (Issue 16)
            return False, 0.0, "unavailable"

        try:
            # Validate input dimensions and types (Issue 13 & 14)
            if any(np.isnan([temperature_c, vibration_mm_s_rms, current_a, rpm])):
                logger.warning("[ML Detector] NaN value detected in sensor inputs. Fallback applied.")
                return False, 0.0, "invalid_input"

            features = np.array([[temperature_c, vibration_mm_s_rms, current_a, rpm]], dtype=float)
            
            # Run prediction (-1 for outlier anomaly, 1 for normal inlier)
            pred = self.pipeline.predict(features)[0]
            is_anomaly = bool(pred == -1)

            # Decision score from Isolation Forest (lower/negative = more anomalous)
            if hasattr(self.pipeline, "decision_function"):
                raw_score = float(self.pipeline.decision_function(features)[0])
            elif hasattr(self.pipeline, "named_steps") and "model" in self.pipeline.named_steps:
                scaler = self.pipeline.named_steps["scaler"]
                scaled = scaler.transform(features)
                raw_score = float(self.pipeline.named_steps["model"].decision_function(scaled)[0])
            else:
                raw_score = -0.1 if is_anomaly else 0.1

            return is_anomaly, round(raw_score, 4), self.model_version
        except Exception as e:
            logger.error(f"[ML Detector] Inference failed: {e}. Graceful fallback engaged.")
            return False, 0.0, "error_fallback"

ml_detector = MLAnomalyDetector()
