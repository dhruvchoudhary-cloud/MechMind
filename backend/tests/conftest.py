import sys
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
ROOT_DIR = BACKEND_DIR.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.main import app
from app.database import Base, get_db
from app import models
from app.config import settings
from app.services.maintenance_agent import maintenance_agent
from simulator.sensor_simulator import simulator

TEST_DB_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(scope="function", autouse=True)
def setup_test_db():
    # Save settings snapshot
    orig_temp_warn = settings.TEMP_WARNING_C
    orig_temp_crit = settings.TEMP_CRITICAL_C
    orig_vib_warn = settings.VIBRATION_WARNING_RMS
    orig_vib_crit = settings.VIBRATION_CRITICAL_RMS
    orig_sim_interval = settings.SIMULATION_INTERVAL_SEC
    orig_risk_low = settings.RISK_LOW_MAX
    orig_risk_med = settings.RISK_MEDIUM_MAX
    orig_risk_high = settings.RISK_HIGH_MAX

    simulator.stop_loop()
    simulator.reset()
    if hasattr(maintenance_agent, "_consecutive_normal"):
        maintenance_agent._consecutive_normal = {}

    Base.metadata.create_all(bind=test_engine)
    db = TestingSessionLocal()
    m1 = models.Machine(
        machine_code="motor-001",
        name="Assembly Line Motor",
        machine_type="Induction Motor",
        location="Line A",
        criticality="HIGH",
        custom_temp_limit_c=None,
        custom_vib_limit_rms=None,
        nominal_rpm=1485.0
    )
    m2 = models.Machine(
        machine_code="motor-002",
        name="Conveyor Motor",
        machine_type="Continuous Duty Motor",
        location="Line B",
        criticality="MEDIUM",
        custom_temp_limit_c=None,
        custom_vib_limit_rms=None,
        nominal_rpm=1440.0
    )
    m3 = models.Machine(
        machine_code="motor-003",
        name="Cooling Pump Motor",
        machine_type="Pump Motor",
        location="Chiller",
        criticality="HIGH",
        custom_temp_limit_c=None,
        custom_vib_limit_rms=None,
        nominal_rpm=1750.0
    )
    db.add_all([m1, m2, m3])
    db.commit()
    db.close()

    yield

    simulator.stop_loop()
    simulator.reset()
    Base.metadata.drop_all(bind=test_engine)

    # Restore settings
    settings.TEMP_WARNING_C = orig_temp_warn
    settings.TEMP_CRITICAL_C = orig_temp_crit
    settings.VIBRATION_WARNING_RMS = orig_vib_warn
    settings.VIBRATION_CRITICAL_RMS = orig_vib_crit
    settings.SIMULATION_INTERVAL_SEC = orig_sim_interval
    settings.RISK_LOW_MAX = orig_risk_low
    settings.RISK_MEDIUM_MAX = orig_risk_med
    settings.RISK_HIGH_MAX = orig_risk_high
    if hasattr(maintenance_agent, "_consecutive_normal"):
        maintenance_agent._consecutive_normal = {}

@pytest.fixture
def client():
    return TestClient(app)
