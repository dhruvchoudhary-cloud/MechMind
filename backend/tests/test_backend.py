import os
import sys
import pytest
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
ROOT_DIR = BACKEND_DIR.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.services.rules import RuleEngine
from app.services.risk_engine import RiskEngine
from app.services.ml_detector import MLAnomalyDetector


# Test 1: Successful telemetry ingestion
def test_1_successful_telemetry_ingestion(client):
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


# Test 2: Unknown machine rejection
def test_2_unknown_machine_rejection(client):
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


# Test 3: Invalid sensor payload rejection
def test_3_invalid_sensor_payload_rejection(client):
    # Unrealistic negative vibration and extreme impossible temperature
    payload = {
        "machine_id": "motor-001",
        "temperature_c": 999.0,  # exceeds ge/le boundary
        "vibration_mm_s_rms": -5.0,
        "current_a": 8.0,
        "rpm": 1450.0
    }
    response = client.post("/api/v1/telemetry", json=payload)
    assert response.status_code == 422


# Test 4: Normal readings producing low risk health status
def test_4_normal_readings_health_status(client):
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


# Test 5: Temperature violations triggering rule detection
def test_5_temperature_violation_rule_detection():
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


# Test 6: Vibration violations triggering rule detection
def test_6_vibration_violation_rule_detection():
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


# Test 7: ML anomaly detection unit test
def test_7_ml_anomaly_detection_behavior():
    detector = MLAnomalyDetector(model_path="non_existent_file.joblib")
    assert detector.is_loaded is False
    is_anomaly, score, version = detector.predict(50.0, 2.0, 8.0, 1450.0)
    assert is_anomaly is False
    assert version == "unavailable"


# Test 8: Risk level classification
def test_8_risk_level_classification():
    risk_engine = RiskEngine()
    # Test low
    s, level, _ = risk_engine.calculate_risk(0.0, [], False, 0.5, "v1", [])
    assert level == "low"

    # Test medium
    s, level, _ = risk_engine.calculate_risk(35.0, [{"feature_name": "temperature_c"}], False, 0.1, "v1", [])
    assert level == "medium"
    assert 25 <= s <= 49

    # Test high / critical
    s, level, _ = risk_engine.calculate_risk(80.0, [{"feature_name": "temp"}, {"feature_name": "vib"}], False, -0.2, "v1", [])
    assert level in ["high", "critical"]
    assert s >= 75 or level == "high"


# Test 9: Automatic alert creation on abnormal telemetry
def test_9_automatic_alert_creation(client):
    payload = {
        "machine_id": "motor-001",
        "temperature_c": 86.0,  # Critical temp
        "vibration_mm_s_rms": 2.2,
        "current_a": 8.5,
        "rpm": 1480.0
    }
    response = client.post("/api/v1/telemetry", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["new_alert_created"] is True
    assert data["active_alert_id"] is not None

    # Check alert endpoint
    alerts_res = client.get("/api/v1/alerts")
    assert alerts_res.status_code == 200
    alerts = alerts_res.json()
    assert len(alerts) >= 1
    assert alerts[0]["alert_type"] == "OVERHEATING"


# Test 10: Alert deduplication (no duplicate active alerts for same incident)
def test_10_alert_deduplication(client):
    payload = {
        "machine_id": "motor-001",
        "temperature_c": 84.0,
        "vibration_mm_s_rms": 2.2,
        "current_a": 8.5,
        "rpm": 1480.0
    }
    # First ingestion creates alert
    res1 = client.post("/api/v1/telemetry", json=payload)
    assert res1.json()["new_alert_created"] is True
    first_alert_id = res1.json()["active_alert_id"]

    # Second ingestion with same fault should update, NOT create a second active alert
    payload["temperature_c"] = 85.5
    res2 = client.post("/api/v1/telemetry", json=payload)
    assert res2.json()["new_alert_created"] is False
    assert res2.json()["active_alert_id"] == first_alert_id

    # Total active alerts should remain 1
    alerts_res = client.get("/api/v1/alerts?status=active")
    assert len(alerts_res.json()) == 1


# Test 11: Automatic maintenance task creation
def test_11_automatic_maintenance_task_creation(client):
    payload = {
        "machine_id": "motor-002",
        "temperature_c": 52.0,
        "vibration_mm_s_rms": 7.5,  # High vibration
        "current_a": 8.0,
        "rpm": 1440.0
    }
    res = client.post("/api/v1/telemetry", json=payload)
    data = res.json()
    assert data["task_created"] is True
    assert data["generated_task_id"] is not None

    tasks_res = client.get("/api/v1/tasks")
    assert tasks_res.status_code == 200
    tasks = tasks_res.json()
    assert len(tasks) >= 1
    assert "Vibration" in tasks[0]["title"] or "CRITICAL" in tasks[0]["title"] or "HIGH" in tasks[0]["title"]
    assert "Recommended Action Plan" in tasks[0]["recommendation"]


# Test 12: Prevention of duplicate maintenance tasks
def test_12_prevention_of_duplicate_tasks(client):
    payload = {
        "machine_id": "motor-003",
        "temperature_c": 88.0,
        "vibration_mm_s_rms": 2.0,
        "current_a": 11.0,
        "rpm": 1750.0
    }
    # Step 1: creates task
    res1 = client.post("/api/v1/telemetry", json=payload)
    assert res1.json()["task_created"] is True

    # Step 2: repeat reading
    res2 = client.post("/api/v1/telemetry", json=payload)
    assert res2.json()["task_created"] is False

    tasks_res = client.get("/api/v1/tasks?machine_id=motor-003")
    assert len(tasks_res.json()) == 1


# Test 13: Alert status transitions (active -> acknowledged -> resolved)
def test_13_alert_status_transitions(client):
    payload = {"machine_id": "motor-001", "temperature_c": 82.0, "vibration_mm_s_rms": 2.0, "current_a": 8.0, "rpm": 1450.0}
    res = client.post("/api/v1/telemetry", json=payload)
    alert_id = res.json()["active_alert_id"]

    # Acknowledge
    ack_res = client.patch(f"/api/v1/alerts/{alert_id}", json={"status": "acknowledged"})
    assert ack_res.status_code == 200
    assert ack_res.json()["status"] == "acknowledged"

    # Resolve
    resolve_res = client.patch(f"/api/v1/alerts/{alert_id}", json={"status": "resolved"})
    assert resolve_res.status_code == 200
    assert resolve_res.json()["status"] == "resolved"
    assert resolve_res.json()["resolved_at"] is not None


# Test 14: Task status transitions (open -> in_progress -> completed)
def test_14_task_status_transitions(client):
    payload = {"machine_id": "motor-001", "temperature_c": 85.0, "vibration_mm_s_rms": 2.0, "current_a": 8.0, "rpm": 1450.0}
    res = client.post("/api/v1/telemetry", json=payload)
    task_id = res.json()["generated_task_id"]

    # In progress
    prog_res = client.patch(f"/api/v1/tasks/{task_id}", json={"status": "in_progress", "notes": "Technician dispatched to Bay 1"})
    assert prog_res.status_code == 200
    assert prog_res.json()["status"] == "in_progress"
    assert prog_res.json()["notes"] == "Technician dispatched to Bay 1"

    # Completed
    comp_res = client.patch(f"/api/v1/tasks/{task_id}", json={"status": "completed"})
    assert comp_res.status_code == 200
    assert comp_res.json()["status"] == "completed"
    assert comp_res.json()["completed_at"] is not None


# Test 15: Simulator scenario activation
def test_15_simulator_scenario_activation(client):
    # Overheating scenario
    res = client.post("/api/v1/simulator/scenario", json={"scenario": "overheating"})
    assert res.status_code == 200
    assert res.json()["status"] == "success"
    assert res.json()["current_scenario"] == "overheating"

    # Single tick generates reading reflecting scenario
    tick_res = client.post("/api/v1/simulator/tick")
    assert tick_res.status_code == 200
    assert len(tick_res.json()["assessments"]) == 3


# Test 16: Dashboard counts matching database state
def test_16_dashboard_counts_match_database(client):
    # Ingest 1 normal reading on motor-001, 1 critical on motor-002
    client.post("/api/v1/telemetry", json={"machine_id": "motor-001", "temperature_c": 55.0, "vibration_mm_s_rms": 2.0, "current_a": 8.0, "rpm": 1450.0})
    client.post("/api/v1/telemetry", json={"machine_id": "motor-002", "temperature_c": 92.0, "vibration_mm_s_rms": 8.0, "current_a": 14.0, "rpm": 1350.0})

    dash_res = client.get("/api/v1/dashboard/summary")
    assert dash_res.status_code == 200
    d = dash_res.json()
    assert d["total_machines"] == 3
    assert d["active_alerts"] >= 1
    assert d["open_maintenance_tasks"] >= 1
    assert d["critical_machines"] >= 1


# Test 17: Rule-based fallback when ML model is unavailable
def test_17_rule_fallback_when_ml_unavailable():
    # Model detector initialized with invalid path
    fallback_detector = MLAnomalyDetector(model_path="invalid_path.joblib")
    assert fallback_detector.is_loaded is False

    is_anomaly, score, version = fallback_detector.predict(85.0, 7.0, 10.0, 1450.0)
    assert is_anomaly is False
    assert version == "unavailable"

    # Rule engine still computes correct score and violations
    rule_engine = RuleEngine()
    rule_score, violations, causes = rule_engine.evaluate(85.0, 7.0, 10.0, 1450.0)
    assert rule_score >= 85.0  # critical temp + critical vib
    assert len(violations) == 2


# Test 18: Recovery scenario auto-resolves active alerts (Issue 6 & 15)
def test_18_recovery_auto_resolves_active_alerts(client):
    # 1. Trigger overheating fault -> creates active alert
    payload_fault = {"machine_id": "motor-001", "temperature_c": 86.0, "vibration_mm_s_rms": 2.0, "current_a": 8.0, "rpm": 1450.0}
    res1 = client.post("/api/v1/telemetry", json=payload_fault)
    assert res1.json()["new_alert_created"] is True
    alert_id = res1.json()["active_alert_id"]

    # Check alert is active
    alert_before = client.get(f"/api/v1/alerts/{alert_id}").json()
    assert alert_before["status"] == "active"

    # 2. Simulate recovery reading -> normal baseline with hysteresis (requires 3 consecutive normal ticks)
    payload_normal = {"machine_id": "motor-001", "temperature_c": 54.0, "vibration_mm_s_rms": 2.0, "current_a": 8.0, "rpm": 1450.0}
    # Tick 1: still active (hysteresis count 1)
    client.post("/api/v1/telemetry", json=payload_normal)
    assert client.get(f"/api/v1/alerts/{alert_id}").json()["status"] == "active"

    # Tick 2: still active (hysteresis count 2)
    client.post("/api/v1/telemetry", json=payload_normal)
    assert client.get(f"/api/v1/alerts/{alert_id}").json()["status"] == "active"

    # Tick 3: hysteresis satisfied (count 3) -> auto-resolves!
    res3 = client.post("/api/v1/telemetry", json=payload_normal)
    assert res3.json()["risk_level"] == "low"

    # Check alert is now resolved automatically by recovery policy
    alert_after = client.get(f"/api/v1/alerts/{alert_id}").json()
    assert alert_after["status"] == "resolved"
    assert "Auto-resolved" in alert_after["description"]


# Test 19: Simulator lifecycle and race-free reset (Issue 2 & 9)
def test_19_simulator_lifecycle_and_race_free_reset(client):
    from simulator.sensor_simulator import simulator

    # Test repeated start/stop cycles
    start_res = client.post("/api/v1/simulator/start")
    assert start_res.status_code == 200
    assert simulator.is_running is True

    stop_res = client.post("/api/v1/simulator/stop")
    assert stop_res.status_code == 200
    assert simulator.is_running is False

    # Start again, then reset
    client.post("/api/v1/simulator/start")
    reset_res = client.post("/api/v1/simulator/reset")
    assert reset_res.status_code == 200
    # Must leave simulator stopped to prevent racing (Issue 2)
    assert simulator.is_running is False
    assert simulator.current_scenario == "normal"


# Test 20: Settings persistence to SQLite (Issue 3 & 23)
def test_20_settings_persistence(client):
    new_settings = {
        "temp_warning_c": 72.5,
        "temp_critical_c": 88.0,
        "vibration_warning_rms": 4.2,
        "vibration_critical_rms": 6.8,
        "current_min_a": 2.5,
        "current_max_a": 16.0,
        "rpm_min": 950.0,
        "rpm_max": 1850.0,
        "simulation_interval_sec": 3.5,
        "risk_low_max": 24,
        "risk_medium_max": 49,
        "risk_high_max": 74
    }
    put_res = client.put("/api/v1/settings", json=new_settings)
    assert put_res.status_code == 200
    assert put_res.json()["temp_warning_c"] == 72.5
    assert put_res.json()["simulation_interval_sec"] == 3.5

    # Fetch to verify persisted
    get_res = client.get("/api/v1/settings")
    assert get_res.status_code == 200
    assert get_res.json()["temp_warning_c"] == 72.5


# Test 21: Machine custom threshold evaluation (Issue 17)
def test_21_machine_custom_threshold_evaluation():
    rule_engine = RuleEngine()
    # Machine with custom high vibration limit of 5.5 mm/s (instead of global 4.0 mm/s)
    score, violations, causes = rule_engine.evaluate(
        temperature_c=55.0,
        vibration_mm_s_rms=4.5,  # > 4.0 global, but < 5.5 custom
        current_a=8.0,
        rpm=1450.0,
        custom_vib_limit_rms=5.5
    )
    # Should NOT violate vibration rule because 4.5 < custom limit 5.5
    assert not any(v["feature_name"] == "vibration_mm_s_rms" for v in violations)
    assert score == 0.0


# Test 22: Stale reading detection (Issue 14 & 22)
def test_22_stale_reading_detection(client):
    import datetime
    from app.utils import utc_now

    # Ingest a reading timestamped 60 seconds ago
    old_time = utc_now() - datetime.timedelta(seconds=60)
    payload = {
        "machine_id": "motor-001",
        "timestamp": old_time.isoformat(),
        "temperature_c": 55.0,
        "vibration_mm_s_rms": 2.0,
        "current_a": 8.0,
        "rpm": 1450.0
    }
    res = client.post("/api/v1/telemetry", json=payload)
    assert res.status_code == 201

    # Check machines summary
    machines_res = client.get("/api/v1/machines")
    assert machines_res.status_code == 200
    m1 = next(m for m in machines_res.json() if m["machine_code"] == "motor-001")
    assert m1["is_stale"] is True

