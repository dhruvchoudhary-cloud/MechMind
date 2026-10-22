import math
import pytest
from app.services.rules import RuleEngine
from app.config import settings

def test_successful_telemetry_ingestion(client):
    payload = {
        "machine_id": "motor-001",
        "temperature_c": 55.4,
        "vibration_mm_s_rms": 2.1,
        "current_a": 8.5,
        "rpm": 1480.0
    }
    response = client.post("/api/v1/telemetry", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["machine_code"] == "motor-001"
    assert "risk_score" in data
    assert "reading_id" in data
    assert data["timestamp"].endswith("Z")


def test_unknown_machine_rejection(client):
    payload = {
        "machine_id": "non-existent-motor-999",
        "temperature_c": 55.0,
        "vibration_mm_s_rms": 2.0,
        "current_a": 8.0,
        "rpm": 1450.0
    }
    response = client.post("/api/v1/telemetry", json=payload)
    assert response.status_code == 404
    assert "does not exist" in response.json()["detail"]


def test_invalid_sensor_payload_bounds(client):
    payload = {
        "machine_id": "motor-001",
        "temperature_c": 999.0,  # exceeds 250 boundary
        "vibration_mm_s_rms": -5.0,
        "current_a": 8.0,
        "rpm": 1450.0
    }
    response = client.post("/api/v1/telemetry", json=payload)
    assert response.status_code == 422


def test_nan_and_inf_payload_rejection(client):
    res_nan = client.post(
        "/api/v1/telemetry",
        content='{"machine_id":"motor-001","temperature_c":NaN,"vibration_mm_s_rms":2.0,"current_a":8.0,"rpm":1450.0}',
        headers={"Content-Type": "application/json"}
    )
    assert res_nan.status_code == 422

    res_inf = client.post(
        "/api/v1/telemetry",
        content='{"machine_id":"motor-001","temperature_c":Infinity,"vibration_mm_s_rms":2.0,"current_a":8.0,"rpm":1450.0}',
        headers={"Content-Type": "application/json"}
    )
    assert res_inf.status_code == 422


def test_ancient_or_futuristic_timestamp_rejection(client):
    import datetime
    from app.utils import utc_now

    # 3 days old reading
    old_time = utc_now() - datetime.timedelta(days=3)
    payload_old = {
        "machine_id": "motor-001",
        "timestamp": old_time.isoformat(),
        "temperature_c": 55.0,
        "vibration_mm_s_rms": 2.0,
        "current_a": 8.0,
        "rpm": 1450.0
    }
    res_old = client.post("/api/v1/telemetry", json=payload_old)
    assert res_old.status_code == 422
    assert "24 hours" in str(res_old.json()["detail"])

    # 1 year in the future reading
    future_time = utc_now() + datetime.timedelta(days=365)
    payload_future = {
        "machine_id": "motor-001",
        "timestamp": future_time.isoformat(),
        "temperature_c": 55.0,
        "vibration_mm_s_rms": 2.0,
        "current_a": 8.0,
        "rpm": 1450.0
    }
    res_future = client.post("/api/v1/telemetry", json=payload_future)
    assert res_future.status_code == 422
    assert "future" in str(res_future.json()["detail"]).lower()


def test_normal_readings_health_status(client):
    payload = {
        "machine_id": "motor-002",
        "temperature_c": 52.0,
        "vibration_mm_s_rms": 1.8,
        "current_a": 7.5,
        "rpm": 1440.0
    }
    response = client.post("/api/v1/telemetry", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["risk_level"] == "low"
    assert data["risk_score"] < 25
    assert data["new_alert_created"] is False
    assert data["task_created"] is False


def test_temperature_violation_rule_detection():
    rule_engine = RuleEngine()
    score, violations, causes = rule_engine.evaluate(
        temperature_c=82.0,  # > 70 warning
        vibration_mm_s_rms=2.0,
        current_a=8.0,
        rpm=1450.0
    )
    assert score >= 35.0
    temp_violation = next((v for v in violations if v["feature_name"] == "temperature_c"), None)
    assert temp_violation is not None
    assert temp_violation["severity"] == "warning"
    assert any("cooling" in c.lower() or "lubrication" in c.lower() for c in causes)


def test_vibration_violation_rule_detection():
    rule_engine = RuleEngine()
    score, violations, causes = rule_engine.evaluate(
        temperature_c=55.0,
        vibration_mm_s_rms=7.2,  # > 6.5 critical
        current_a=8.0,
        rpm=1450.0
    )
    assert score >= 50.0
    vib_violation = next((v for v in violations if v["feature_name"] == "vibration_mm_s_rms"), None)
    assert vib_violation is not None
    assert vib_violation["severity"] == "critical"
    assert any("bearing" in c.lower() or "unbalance" in c.lower() for c in causes)


def test_stopped_motor_no_fault():
    rule_engine = RuleEngine()
    # Motor with 0 A current and 0 RPM is in standby/stopped
    score, violations, causes = rule_engine.evaluate(
        temperature_c=25.0,
        vibration_mm_s_rms=0.05,
        current_a=0.0,
        rpm=0.0
    )
    assert score == 0.0
    assert len(violations) == 0


def test_machine_custom_threshold_override():
    rule_engine = RuleEngine()
    # Custom high vibration limit of 5.5 mm/s (instead of global 4.0 mm/s)
    score, violations, causes = rule_engine.evaluate(
        temperature_c=55.0,
        vibration_mm_s_rms=4.5,
        current_a=8.0,
        rpm=1450.0,
        custom_vib_limit_rms=5.5
    )
    assert not any(v["feature_name"] == "vibration_mm_s_rms" for v in violations)
    assert score == 0.0
