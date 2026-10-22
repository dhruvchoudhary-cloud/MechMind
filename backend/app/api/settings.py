import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app import models, schemas
from app.utils import utc_now

# Import simulator to sync interval (Issue 3)
from simulator.sensor_simulator import simulator

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get("", response_model=schemas.SystemSettingsModel)
def get_system_settings(db: Session = Depends(get_db)):
    """Returns the current configurable demonstration thresholds."""
    return schemas.SystemSettingsModel(
        temp_warning_c=settings.TEMP_WARNING_C,
        temp_critical_c=settings.TEMP_CRITICAL_C,
        vibration_warning_rms=settings.VIBRATION_WARNING_RMS,
        vibration_critical_rms=settings.VIBRATION_CRITICAL_RMS,
        current_min_a=settings.CURRENT_MIN_A,
        current_max_a=settings.CURRENT_MAX_A,
        rpm_min=settings.RPM_MIN,
        rpm_max=settings.RPM_MAX,
        simulation_interval_sec=settings.SIMULATION_INTERVAL_SEC,
        risk_low_max=settings.RISK_LOW_MAX,
        risk_medium_max=settings.RISK_MEDIUM_MAX,
        risk_high_max=settings.RISK_HIGH_MAX,
    )

@router.put("", response_model=schemas.SystemSettingsModel)
def update_system_settings(new_settings: schemas.SystemSettingsModel, db: Session = Depends(get_db)):
    """
    Updates runtime demonstration limits and persists them to SQLite (Issue 3 & 23).
    Also synchronizes the simulator interval dynamically.
    """
    settings.TEMP_WARNING_C = new_settings.temp_warning_c
    settings.TEMP_CRITICAL_C = new_settings.temp_critical_c
    settings.VIBRATION_WARNING_RMS = new_settings.vibration_warning_rms
    settings.VIBRATION_CRITICAL_RMS = new_settings.vibration_critical_rms
    settings.CURRENT_MIN_A = new_settings.current_min_a
    settings.CURRENT_MAX_A = new_settings.current_max_a
    settings.RPM_MIN = new_settings.rpm_min
    settings.RPM_MAX = new_settings.rpm_max
    settings.SIMULATION_INTERVAL_SEC = new_settings.simulation_interval_sec
    settings.RISK_LOW_MAX = new_settings.risk_low_max
    settings.RISK_MEDIUM_MAX = new_settings.risk_medium_max
    settings.RISK_HIGH_MAX = new_settings.risk_high_max

    # Synchronize simulator interval directly (Issue 3)
    simulator.set_interval(new_settings.simulation_interval_sec)

    # Persist to database (Issue 23)
    try:
        setting_rec = db.query(models.SystemSetting).filter(models.SystemSetting.key == "thresholds").first()
        payload_dict = new_settings.model_dump()
        if not setting_rec:
            setting_rec = models.SystemSetting(
                key="thresholds",
                value_json=json.dumps(payload_dict),
                updated_at=utc_now()
            )
            db.add(setting_rec)
        else:
            setting_rec.value_json = json.dumps(payload_dict)
            setting_rec.updated_at = utc_now()
        db.commit()
    except Exception as e:
        db.rollback()

    return get_system_settings(db)
