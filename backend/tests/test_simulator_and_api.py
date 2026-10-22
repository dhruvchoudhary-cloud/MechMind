import pytest
from app import models
from app.config import settings
from simulator.sensor_simulator import simulator


def test_simulator_scenario_activation(client):
    res = client.post("/api/v1/simulator/scenario", json={"scenario": "overheating"})
    assert res.status_code == 200
    assert res.json()["status"] == "success"
    assert res.json()["current_scenario"] == "overheating"

    tick_res = client.post("/api/v1/simulator/tick")
    assert tick_res.status_code == 200
    assert len(tick_res.json()["assessments"]) == 3


def test_simulator_scenario_overheating_and_vibration_alias(client):
    # Blueprint name overheating_and_vibration must NOT return 422
    res = client.post("/api/v1/simulator/scenario", json={"scenario": "overheating_and_vibration"})
    assert res.status_code == 200
    assert res.json()["current_scenario"] == "combined_fault"


def test_simulator_targeted_machine_scenario(client):
    # Target only motor-001
    res = client.post("/api/v1/simulator/scenario", json={"scenario": "overheating", "machine_id": "motor-001"})
    assert res.status_code == 200
    assert "motor-001" in res.json()["active_machines"]

    # Verify simulation tick creates fault ONLY on motor-001, while motor-002 and motor-003 stay normal
    tick_res = client.post("/api/v1/simulator/tick")
    assessments = tick_res.json()["assessments"]
    m1_assess = next(a for a in assessments if a["machine_code"] == "motor-001")
    m2_assess = next(a for a in assessments if a["machine_code"] == "motor-002")
    m3_assess = next(a for a in assessments if a["machine_code"] == "motor-003")

    assert m1_assess["risk_score"] > 30  # High or warning due to overheating
    assert m2_assess["risk_level"] == "low"
    assert m3_assess["risk_level"] == "low"


def test_simulator_invalid_machine_returns_404(client):
    res = client.post("/api/v1/simulator/scenario", json={"scenario": "overheating", "machine_id": "typo-motor-999"})
    assert res.status_code == 404
    detail = res.json()["detail"].lower()
    assert "does not exist" in detail or "not found" in detail


def test_simulator_duration_seconds_accepted(client):
    res = client.post("/api/v1/simulator/scenario", json={"scenario": "overheating", "duration_seconds": 10})
    assert res.status_code == 200
    assert res.json()["status"] == "success"


def test_simulator_lifecycle_concurrency_race_free(client):
    # Rapid start/stop cycles must not spawn orphan duplicate threads
    for _ in range(3):
        start_res = client.post("/api/v1/simulator/start")
        assert start_res.status_code == 200
        assert simulator.is_running is True

        stop_res = client.post("/api/v1/simulator/stop")
        assert stop_res.status_code == 200
        assert simulator.is_running is False

    # Reset leaves simulator stopped
    reset_res = client.post("/api/v1/simulator/reset")
    assert reset_res.status_code == 200
    assert simulator.is_running is False


def test_settings_ordered_validation(client):
    # Reject out-of-order thermal thresholds: warning 85 >= critical 70
    bad_temp = {
        "temp_warning_c": 85.0,
        "temp_critical_c": 70.0,
        "vibration_warning_rms": 4.0,
        "vibration_critical_rms": 6.5,
        "current_min_a": 2.0,
        "current_max_a": 15.0,
        "rpm_min": 1000.0,
        "rpm_max": 1800.0,
        "simulation_interval_sec": 2.5,
        "risk_low_max": 24,
        "risk_medium_max": 49,
        "risk_high_max": 74
    }
    res_bad = client.put("/api/v1/settings", json=bad_temp)
    assert res_bad.status_code == 422

    # Reject out-of-order risk thresholds: risk_low 50 >= risk_med 40
    bad_risk = bad_temp.copy()
    bad_risk["temp_warning_c"] = 70.0
    bad_risk["temp_critical_c"] = 85.0
    bad_risk["risk_low_max"] = 50
    bad_risk["risk_medium_max"] = 40
    res_bad_risk = client.put("/api/v1/settings", json=bad_risk)
    assert res_bad_risk.status_code == 422


def test_settings_persistence_and_isolation(client):
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

    get_res = client.get("/api/v1/settings")
    assert get_res.status_code == 200
    assert get_res.json()["temp_warning_c"] == 72.5


def test_alert_and_task_valid_and_invalid_transitions(client):
    # Ingest fault reading for motor-001 to test task lifecycle
    p = {"machine_id": "motor-001", "temperature_c": 86.0, "vibration_mm_s_rms": 2.0, "current_a": 8.0, "rpm": 1450.0}
    res = client.post("/api/v1/telemetry", json=p)
    task_id = res.json()["generated_task_id"]

    # Valid task transition: open -> in_progress
    prog_res = client.patch(f"/api/v1/tasks/{task_id}", json={"status": "in_progress", "notes": "Dispatched technician"})
    assert prog_res.status_code == 200
    assert prog_res.json()["status"] == "in_progress"

    # Valid task transition: in_progress -> completed
    comp_res = client.patch(f"/api/v1/tasks/{task_id}", json={"status": "completed"})
    assert comp_res.status_code == 200
    assert comp_res.json()["status"] == "completed"

    # Invalid task transition: completed -> open
    inv_task = client.patch(f"/api/v1/tasks/{task_id}", json={"status": "open"})
    assert inv_task.status_code == 400
    assert "Invalid task status transition" in inv_task.json()["detail"]

    # Ingest fault reading for motor-002 to test alert lifecycle
    p2 = {"machine_id": "motor-002", "temperature_c": 52.0, "vibration_mm_s_rms": 7.5, "current_a": 8.0, "rpm": 1440.0}
    res2 = client.post("/api/v1/telemetry", json=p2)
    alert_id = res2.json()["active_alert_id"]

    # Valid alert transition: active -> acknowledged
    ack_res = client.patch(f"/api/v1/alerts/{alert_id}", json={"status": "acknowledged"})
    assert ack_res.status_code == 200
    assert ack_res.json()["status"] == "acknowledged"

    # Valid alert transition: acknowledged -> resolved
    res_res = client.patch(f"/api/v1/alerts/{alert_id}", json={"status": "resolved"})
    assert res_res.status_code == 200
    assert res_res.json()["status"] == "resolved"

    # Invalid alert transition: resolved -> active (terminal state violation)
    inv_res = client.patch(f"/api/v1/alerts/{alert_id}", json={"status": "active"})
    assert inv_res.status_code == 400
    assert "Invalid alert status transition" in inv_res.json()["detail"]


def test_list_endpoints_offset_and_envelope(client):
    # Ingest 2 faults
    client.post("/api/v1/telemetry", json={"machine_id": "motor-001", "temperature_c": 86.0, "vibration_mm_s_rms": 2.0, "current_a": 8.0, "rpm": 1450.0})
    client.post("/api/v1/telemetry", json={"machine_id": "motor-002", "temperature_c": 52.0, "vibration_mm_s_rms": 7.5, "current_a": 8.0, "rpm": 1440.0})

    # Envelope mode for alerts: {items, total, limit, offset}
    env_res = client.get("/api/v1/alerts?envelope=true&limit=1&offset=0")
    assert env_res.status_code == 200
    env_data = env_res.json()
    assert "items" in env_data
    assert "total" in env_data
    assert env_data["total"] >= 2
    assert len(env_data["items"]) == 1
    assert env_data["offset"] == 0

    # Offset pagination
    off_res = client.get("/api/v1/alerts?envelope=true&limit=1&offset=1")
    assert off_res.status_code == 200
    assert off_res.json()["offset"] == 1

    # Envelope mode for tasks
    task_env = client.get("/api/v1/tasks?envelope=true&limit=1&offset=0")
    assert task_env.status_code == 200
    assert "items" in task_env.json()
    assert "total" in task_env.json()


def test_dashboard_summary_contract(client):
    client.post("/api/v1/telemetry", json={"machine_id": "motor-001", "temperature_c": 55.0, "vibration_mm_s_rms": 2.0, "current_a": 8.0, "rpm": 1450.0})
    client.post("/api/v1/telemetry", json={"machine_id": "motor-002", "temperature_c": 92.0, "vibration_mm_s_rms": 8.0, "current_a": 14.0, "rpm": 1350.0})

    res = client.get("/api/v1/dashboard/summary")
    assert res.status_code == 200
    d = res.json()
    assert d["total_machines"] == 3
    assert d["active_alerts"] >= 1
    assert d["open_maintenance_tasks"] >= 1
    assert d["critical_machines"] >= 1


def test_stale_reading_detection(client):
    import datetime
    from app.utils import utc_now

    old_time = utc_now() - datetime.timedelta(seconds=60)
    p = {
        "machine_id": "motor-001",
        "timestamp": old_time.isoformat(),
        "temperature_c": 55.0,
        "vibration_mm_s_rms": 2.0,
        "current_a": 8.0,
        "rpm": 1450.0
    }
    res = client.post("/api/v1/telemetry", json=p)
    assert res.status_code == 201

    machines_res = client.get("/api/v1/machines")
    m1 = next(m for m in machines_res.json() if m["machine_code"] == "motor-001")
    assert m1["is_stale"] is True
