import pytest
from app import models
from app.services.risk_engine import RiskEngine
from app.services.ml_detector import MLAnomalyDetector, ml_detector
from app.services.maintenance_agent import maintenance_agent


def test_ml_model_loaded_and_version():
    assert ml_detector.is_loaded is True
    assert ml_detector.model_version is not None
    assert ml_detector.trained_sklearn_version is not None


def test_ml_healthy_motor_inliers():
    # Verify healthy baseline telemetry across all 3 simulator motor profiles
    # motor-001 profile: ~56 °C, 2.1 mm/s, 8.5 A, 1485 RPM
    is_anom_1, score_1, _ = ml_detector.predict(56.0, 2.1, 8.5, 1485.0)
    assert is_anom_1 is False
    assert score_1 > 0.0  # Inlier positive decision score

    # motor-002 profile: ~51.5 °C, 1.8 mm/s, 7.2 A, 1440 RPM
    is_anom_2, score_2, _ = ml_detector.predict(51.5, 1.8, 7.2, 1440.0)
    assert is_anom_2 is False
    assert score_2 > 0.0

    # motor-003 profile: ~49.0 °C, 1.9 mm/s, 10.8 A, 1750 RPM
    is_anom_3, score_3, _ = ml_detector.predict(49.0, 1.9, 10.8, 1750.0)
    assert is_anom_3 is False
    assert score_3 > 0.0


def test_ml_anomalous_reading_detected():
    # Outlier: high vibration + low current + erratic RPM
    is_anom, score, _ = ml_detector.predict(88.0, 9.5, 1.2, 850.0)
    assert is_anom is True
    assert score < 0.0  # Negative decision score indicates anomaly


def test_ml_fallback_when_unavailable():
    fallback_detector = MLAnomalyDetector(model_path="non_existent_file.joblib")
    assert fallback_detector.is_loaded is False

    is_anomaly, score, version = fallback_detector.predict(55.0, 2.0, 8.0, 1450.0)
    assert is_anomaly is False
    assert version == "unavailable"

    # Risk engine labels evidence as ML_UNAVAILABLE
    risk_engine = RiskEngine()
    s, level, evidence = risk_engine.calculate_risk(
        rule_score=0.0,
        rule_violations=[],
        ml_anomaly=is_anomaly,
        ml_score=score,
        model_version=version,
        possible_causes=[]
    )
    ml_evidence = next((e for e in evidence if e["type"] == "ML_UNAVAILABLE"), None)
    assert ml_evidence is not None


def test_risk_engine_scoring_and_ml_contribution():
    risk_engine = RiskEngine()
    # Baseline normal
    s_norm, l_norm, _ = risk_engine.calculate_risk(0.0, [], False, 0.5, "v1", [])
    assert s_norm == 0.0
    assert l_norm == "low"

    # ML Anomaly contribution: adds +25 points
    s_ml, l_ml, ev_ml = risk_engine.calculate_risk(0.0, [], True, -0.15, "v1", ["Multivariate anomaly"])
    assert s_ml == 25.0
    assert l_ml == "medium"
    assert any(e["type"] == "ML_ANOMALY" for e in ev_ml)


def test_automatic_alert_creation_and_escalation(client):
    # Ingest single thermal fault -> creates OVERHEATING alert
    p1 = {"machine_id": "motor-001", "temperature_c": 86.0, "vibration_mm_s_rms": 2.0, "current_a": 8.0, "rpm": 1450.0}
    r1 = client.post("/api/v1/telemetry", json=p1)
    assert r1.status_code == 201
    assert r1.json()["new_alert_created"] is True
    alert_id = r1.json()["active_alert_id"]

    # Escalating to combined fault (high temp + high vibration)
    p2 = {"machine_id": "motor-001", "temperature_c": 88.0, "vibration_mm_s_rms": 7.5, "current_a": 8.0, "rpm": 1450.0}
    r2 = client.post("/api/v1/telemetry", json=p2)
    assert r2.status_code == 201
    # Should update existing incident in place, NOT create a second parallel alert
    assert r2.json()["new_alert_created"] is False
    assert r2.json()["active_alert_id"] == alert_id

    # Check alert was escalated to COMBINED_FAULT
    alert_check = client.get(f"/api/v1/alerts/{alert_id}").json()
    assert alert_check["alert_type"] == "COMBINED_FAULT"
    assert alert_check["severity"] == "critical"

    # Only 1 active alert exists for this machine
    active_alerts = client.get("/api/v1/alerts?status=active&machine_id=motor-001").json()
    assert len(active_alerts) == 1


def test_alert_deduplication(client):
    p = {"machine_id": "motor-002", "temperature_c": 86.0, "vibration_mm_s_rms": 2.0, "current_a": 8.0, "rpm": 1450.0}
    res1 = client.post("/api/v1/telemetry", json=p)
    assert res1.json()["new_alert_created"] is True
    first_id = res1.json()["active_alert_id"]

    res2 = client.post("/api/v1/telemetry", json=p)
    assert res2.json()["new_alert_created"] is False
    assert res2.json()["active_alert_id"] == first_id

    alerts = client.get("/api/v1/alerts?status=active&machine_id=motor-002").json()
    assert len(alerts) == 1


def test_automatic_maintenance_task_creation(client):
    p = {"machine_id": "motor-002", "temperature_c": 52.0, "vibration_mm_s_rms": 7.5, "current_a": 8.0, "rpm": 1440.0}
    res = client.post("/api/v1/telemetry", json=p)
    data = res.json()
    assert data["task_created"] is True
    assert data["generated_task_id"] is not None

    tasks = client.get("/api/v1/tasks?machine_id=motor-002").json()
    assert len(tasks) >= 1
    assert "Recommended Action Plan" in tasks[0]["recommendation"]


def test_prevention_of_duplicate_tasks(client):
    p = {"machine_id": "motor-003", "temperature_c": 88.0, "vibration_mm_s_rms": 2.0, "current_a": 11.0, "rpm": 1750.0}
    res1 = client.post("/api/v1/telemetry", json=p)
    assert res1.json()["task_created"] is True

    # Repeated fault reading does NOT spawn duplicate task
    res2 = client.post("/api/v1/telemetry", json=p)
    assert res2.json()["task_created"] is False

    tasks = client.get("/api/v1/tasks?machine_id=motor-003").json()
    assert len(tasks) == 1


def test_hysteresis_recovery_auto_resolve(client):
    # 1. Fault reading creates active alert
    p_fault = {"machine_id": "motor-001", "temperature_c": 86.0, "vibration_mm_s_rms": 2.0, "current_a": 8.0, "rpm": 1450.0}
    res1 = client.post("/api/v1/telemetry", json=p_fault)
    alert_id = res1.json()["active_alert_id"]
    task_id = res1.json()["generated_task_id"]

    # 2. First normal reading - alert remains active due to hysteresis
    p_norm = {"machine_id": "motor-001", "temperature_c": 54.0, "vibration_mm_s_rms": 2.0, "current_a": 8.0, "rpm": 1450.0}
    client.post("/api/v1/telemetry", json=p_norm)
    check1 = client.get(f"/api/v1/alerts/{alert_id}").json()
    assert check1["status"] == "active"

    # 3. Second normal reading - still active
    client.post("/api/v1/telemetry", json=p_norm)
    check2 = client.get(f"/api/v1/alerts/{alert_id}").json()
    assert check2["status"] == "active"

    # 4. Third consecutive normal reading - hysteresis satisfied, auto-resolves!
    client.post("/api/v1/telemetry", json=p_norm)
    check3 = client.get(f"/api/v1/alerts/{alert_id}").json()
    assert check3["status"] == "resolved"
    assert "Auto-resolved" in check3["description"]

    # Associated maintenance task is also auto-completed
    task_check = client.get(f"/api/v1/tasks/{task_id}").json()
    assert task_check["status"] == "completed"
