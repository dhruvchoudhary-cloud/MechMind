from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent.parent

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=str(BASE_DIR / ".env"), extra="allow")

    PROJECT_NAME: str = "MechMind - Autonomous Maintenance Agent"
    VERSION: str = "2.0.0"
    API_V1_PREFIX: str = "/api/v1"
    
    # Environment & Security
    DEMO_MODE: bool = True
    ENABLE_SIMULATOR_ENDPOINTS: bool = True
    
    # Database
    DATABASE_URL: str = f"sqlite:///{BASE_DIR / 'predict_maintenance.db'}"
    
    # Strict CORS Origins (No wildcard when credentials or security is active)
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]
    
    # ML Model
    ML_MODEL_PATH: str = str(BASE_DIR / "ml" / "artifacts" / "isolation_forest_v1.joblib")
    MODEL_METADATA_PATH: str = str(BASE_DIR / "ml" / "artifacts" / "model_metadata.json")
    MODEL_VERSION: str = "iforest-v1.0"
    
    # Demonstration Default Thresholds
    TEMP_WARNING_C: float = 70.0
    TEMP_CRITICAL_C: float = 85.0
    VIBRATION_WARNING_RMS: float = 4.0
    VIBRATION_CRITICAL_RMS: float = 6.5
    CURRENT_MIN_A: float = 2.0
    CURRENT_MAX_A: float = 15.0
    RPM_MIN: float = 1000.0
    RPM_MAX: float = 1800.0
    
    # Risk Score thresholds
    RISK_LOW_MAX: int = 24
    RISK_MEDIUM_MAX: int = 49
    RISK_HIGH_MAX: int = 74
    
    # Simulation & Policy
    SIMULATION_INTERVAL_SEC: float = 2.5
    AUTO_RESOLVE_ON_RECOVERY: bool = True
    STALE_TELEMETRY_THRESHOLD_SEC: float = 20.0

settings = Settings()
