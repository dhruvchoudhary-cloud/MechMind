import sys
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app import models, schemas
from app.services.maintenance_agent import maintenance_agent

# Import sensor simulator
ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from simulator.sensor_simulator import simulator

router = APIRouter(prefix="/simulator", tags=["Simulator"])

def check_simulator_access():
    if not settings.ENABLE_SIMULATOR_ENDPOINTS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Simulator controls are disabled outside demonstration environment."
        )

@router.post("/scenario", response_model=schemas.SimulatorActionResponse)
def trigger_scenario(payload: schemas.ScenarioRequest):
    """
    Triggers one of the predefined demonstration scenarios:
    - normal: Nominal healthy operations
    - overheating: Gradual temperature excursion
    - excessive_vibration: Mechanical unbalance/bearing spike
    - combined_fault / overheating_and_vibration: Simultaneous thermal & vibration breakdown
    - recovery: Gradual normalization and alert resolution
    """
    check_simulator_access()
    if payload.machine_id and payload.machine_id not in simulator.machines:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Machine '{payload.machine_id}' does not exist in simulator. Valid machine IDs: {list(simulator.machines.keys())}"
        )
    simulator.set_scenario(
        payload.scenario,
        machine_id=payload.machine_id,
        duration_seconds=payload.duration_seconds
    )
    return schemas.SimulatorActionResponse(
        status="success",
        message=f"Scenario set to '{payload.scenario}' for {('machine ' + payload.machine_id) if payload.machine_id else 'all machines'}.",
        current_scenario=simulator.current_scenario,
        active_machines=list(simulator.machines.keys())
    )


@router.post("/reset", response_model=schemas.SimulatorActionResponse)
def reset_simulation(db: Session = Depends(get_db)):
    """
    Thread-safe reset (Issue 2 & 10):
    1. Stops running simulator thread and ensures no in-flight requests race.
    2. Resets simulator internal state to normal.
    3. Cleans database records (tasks, alerts, predictions, readings) atomically.
    4. Reseeds baseline telemetry.
    5. Leaves simulator stopped until explicitly restarted.
    """
    check_simulator_access()
    
    # Step 1: Stop simulator loop and reset internal states under lock
    simulator.reset()

    # Step 2: Atomic database reset
    try:
        db.query(models.MaintenanceTask).delete()
        db.query(models.Alert).delete()
        db.query(models.Prediction).delete()
        db.query(models.SensorReading).delete()
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to reset database: {e}")

    # Step 3: Reseed clean baseline readings for each machine
    fresh_readings = simulator.generate_tick()
    for r in fresh_readings:
        payload = schemas.TelemetryPayload(**r)
        maintenance_agent.process_reading(db, payload)

    return schemas.SimulatorActionResponse(
        status="success",
        message="Simulation stopped, database cleared, and baseline readings reseeded.",
        current_scenario=simulator.current_scenario,
        active_machines=list(simulator.machines.keys())
    )


@router.post("/tick")
def trigger_tick(db: Session = Depends(get_db)):
    """
    Executes an immediate single simulation step for all machines and ingests through maintenance agent.
    """
    check_simulator_access()
    readings = simulator.generate_tick()
    results = []
    for r in readings:
        payload = schemas.TelemetryPayload(**r)
        assessment = maintenance_agent.process_reading(db, payload)
        results.append(assessment)
    return {
        "status": "success",
        "scenario": simulator.current_scenario,
        "assessments": results
    }


@router.post("/start")
def start_simulation():
    """Starts the continuous background telemetry generation loop (Issue 9)."""
    check_simulator_access()
    simulator.start_loop()
    return {"status": "started", "is_running": simulator.is_running}


@router.post("/stop")
def stop_simulation():
    """Stops the continuous background telemetry generation loop (Issue 9)."""
    check_simulator_access()
    simulator.stop_loop()
    return {"status": "stopped", "is_running": simulator.is_running}


@router.get("/status")
def get_simulator_status():
    """Returns authoritative runtime state of the sensor simulator (Issue 8 & 20)."""
    return simulator.get_status_summary()
