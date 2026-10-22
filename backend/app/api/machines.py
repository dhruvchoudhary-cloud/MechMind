import json
import datetime
from typing import List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.config import settings
from app.utils import utc_now
from app import models, schemas

router = APIRouter(prefix="/machines", tags=["Machines"])

def get_machine_summary(machine: models.Machine, db: Session) -> schemas.MachineSummary:
    latest_reading = (
        db.query(models.SensorReading)
        .filter(models.SensorReading.machine_id == machine.id)
        .order_by(desc(models.SensorReading.timestamp))
        .first()
    )
    latest_pred = (
        db.query(models.Prediction)
        .filter(models.Prediction.machine_id == machine.id)
        .order_by(desc(models.Prediction.created_at))
        .first()
    )
    active_alerts_cnt = (
        db.query(models.Alert)
        .filter(models.Alert.machine_id == machine.id, models.Alert.status.in_(["active", "acknowledged"]))
        .count()
    )

    is_stale = False
    if latest_reading and latest_reading.timestamp:
        r_time = latest_reading.timestamp
        if r_time.tzinfo is None:
            r_time = r_time.replace(tzinfo=datetime.timezone.utc)
        time_elapsed = (utc_now() - r_time).total_seconds()
        if time_elapsed > settings.STALE_TELEMETRY_THRESHOLD_SEC:
            is_stale = True

    return schemas.MachineSummary(
        id=machine.id,
        machine_code=machine.machine_code,
        name=machine.name,
        machine_type=machine.machine_type,
        location=machine.location,
        criticality=machine.criticality,
        status=machine.status,
        created_at=machine.created_at,
        latest_temperature=latest_reading.temperature_c if latest_reading else None,
        latest_vibration=latest_reading.vibration_mm_s_rms if latest_reading else None,
        latest_current=latest_reading.current_a if latest_reading else None,
        latest_rpm=latest_reading.rpm if latest_reading else None,
        latest_reading_time=latest_reading.timestamp if latest_reading else None,
        risk_score=latest_pred.risk_score if latest_pred else 0.0,
        risk_level=latest_pred.risk_level if latest_pred else "low",
        active_alert_count=active_alerts_cnt,
        is_stale=is_stale
    )

@router.get("", response_model=Union[schemas.PaginatedMachines, List[schemas.MachineSummary]])
def list_machines(
    status: Optional[str] = Query(None, description="Filter by operational status"),
    machine_type: Optional[str] = Query(None, description="Filter by machine type"),
    search: Optional[str] = Query(None, description="Search by code or name"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    envelope: bool = Query(False, description="Return {items, total} paginated envelope"),
    db: Session = Depends(get_db)
):
    query = db.query(models.Machine)
    if status:
        query = query.filter(models.Machine.status == status)
    if machine_type:
        query = query.filter(models.Machine.machine_type == machine_type)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (models.Machine.machine_code.ilike(search_filter)) |
            (models.Machine.name.ilike(search_filter))
        )

    total_count = query.count()
    machines = query.offset(offset).limit(limit).all()
    formatted = [get_machine_summary(m, db) for m in machines]
    if envelope:
        return schemas.PaginatedMachines(items=formatted, total=total_count, limit=limit, offset=offset)
    return formatted


@router.get("/{machine_id}", response_model=schemas.MachineDetailResponse)
def get_machine(machine_id: str, db: Session = Depends(get_db)):
    # Support lookup by machine_code (e.g. motor-001) or integer id
    if machine_id.isdigit():
        machine = db.query(models.Machine).filter(models.Machine.id == int(machine_id)).first()
    else:
        machine = db.query(models.Machine).filter(models.Machine.machine_code == machine_id).first()

    if not machine:
        raise HTTPException(status_code=404, detail=f"Machine '{machine_id}' not found.")

    latest_reading = (
        db.query(models.SensorReading)
        .filter(models.SensorReading.machine_id == machine.id)
        .order_by(desc(models.SensorReading.timestamp))
        .first()
    )
    latest_pred = (
        db.query(models.Prediction)
        .filter(models.Prediction.machine_id == machine.id)
        .order_by(desc(models.Prediction.created_at))
        .first()
    )

    evidence_data = []
    possible_causes = []
    if latest_pred and latest_pred.evidence_json:
        try:
            parsed = json.loads(latest_pred.evidence_json)
            evidence_data = parsed.get("evidence", [])
            possible_causes = parsed.get("possible_causes", [])
        except Exception:
            pass

    current_health = schemas.HealthAssessmentResponse(
        machine_code=machine.machine_code,
        machine_name=machine.name,
        risk_score=latest_pred.risk_score if latest_pred else 0.0,
        risk_level=latest_pred.risk_level if latest_pred else "low",
        rule_score=latest_pred.rule_score if latest_pred else 0.0,
        ml_anomaly=latest_pred.ml_anomaly if latest_pred else False,
        ml_score=latest_pred.ml_score if latest_pred else None,
        model_version=latest_pred.model_version if latest_pred else "n/a",
        evidence=evidence_data,
        possible_causes=possible_causes,
        reading_id=latest_reading.id if latest_reading else 0,
        timestamp=latest_reading.timestamp if latest_reading else machine.created_at
    )

    recent_readings = (
        db.query(models.SensorReading)
        .filter(models.SensorReading.machine_id == machine.id)
        .order_by(desc(models.SensorReading.timestamp))
        .limit(60)
        .all()
    )
    # Reverse so charts display chronologically left-to-right
    recent_readings = list(reversed(recent_readings))

    recent_alerts = (
        db.query(models.Alert)
        .filter(models.Alert.machine_id == machine.id)
        .order_by(desc(models.Alert.last_seen_at))
        .limit(10)
        .all()
    )

    related_tasks = (
        db.query(models.MaintenanceTask)
        .filter(models.MaintenanceTask.machine_id == machine.id)
        .order_by(desc(models.MaintenanceTask.created_at))
        .limit(10)
        .all()
    )

    def to_alert_resp(a):
        return schemas.AlertResponse(
            id=a.id,
            machine_id=a.machine_id,
            machine_code=machine.machine_code,
            machine_name=machine.name,
            prediction_id=a.prediction_id,
            alert_type=a.alert_type,
            severity=a.severity,
            description=a.description,
            status=a.status,
            deduplication_key=a.deduplication_key,
            first_seen_at=a.first_seen_at,
            last_seen_at=a.last_seen_at,
            resolved_at=a.resolved_at,
            task_id=a.task.id if a.task else None
        )

    def to_task_resp(t):
        return schemas.MaintenanceTaskResponse(
            id=t.id,
            machine_id=t.machine_id,
            machine_code=machine.machine_code,
            machine_name=machine.name,
            alert_id=t.alert_id,
            title=t.title,
            description=t.description,
            priority=t.priority,
            recommendation=t.recommendation,
            status=t.status,
            notes=t.notes,
            created_at=t.created_at,
            completed_at=t.completed_at
        )

    return schemas.MachineDetailResponse(
        id=machine.id,
        machine_code=machine.machine_code,
        name=machine.name,
        machine_type=machine.machine_type,
        location=machine.location,
        criticality=machine.criticality,
        status=machine.status,
        created_at=machine.created_at,
        current_health=current_health,
        recent_readings=[schemas.ReadingItem.model_validate(r) for r in recent_readings],
        recent_alerts=[to_alert_resp(a) for a in recent_alerts],
        related_tasks=[to_task_resp(t) for t in related_tasks]
    )


@router.get("/{machine_id}/health", response_model=schemas.HealthAssessmentResponse)
def get_machine_health(machine_id: str, db: Session = Depends(get_db)):
    if machine_id.isdigit():
        machine = db.query(models.Machine).filter(models.Machine.id == int(machine_id)).first()
    else:
        machine = db.query(models.Machine).filter(models.Machine.machine_code == machine_id).first()

    if not machine:
        raise HTTPException(status_code=404, detail=f"Machine '{machine_id}' not found.")

    latest_reading = (
        db.query(models.SensorReading)
        .filter(models.SensorReading.machine_id == machine.id)
        .order_by(desc(models.SensorReading.timestamp))
        .first()
    )
    latest_pred = (
        db.query(models.Prediction)
        .filter(models.Prediction.machine_id == machine.id)
        .order_by(desc(models.Prediction.created_at))
        .first()
    )

    evidence_data = []
    possible_causes = []
    if latest_pred and latest_pred.evidence_json:
        try:
            parsed = json.loads(latest_pred.evidence_json)
            evidence_data = parsed.get("evidence", [])
            possible_causes = parsed.get("possible_causes", [])
        except Exception:
            pass

    return schemas.HealthAssessmentResponse(
        machine_code=machine.machine_code,
        machine_name=machine.name,
        risk_score=latest_pred.risk_score if latest_pred else 0.0,
        risk_level=latest_pred.risk_level if latest_pred else "low",
        rule_score=latest_pred.rule_score if latest_pred else 0.0,
        ml_anomaly=latest_pred.ml_anomaly if latest_pred else False,
        ml_score=latest_pred.ml_score if latest_pred else None,
        model_version=latest_pred.model_version if latest_pred else "n/a",
        evidence=evidence_data,
        possible_causes=possible_causes,
        reading_id=latest_reading.id if latest_reading else 0,
        timestamp=latest_reading.timestamp if latest_reading else machine.created_at
    )


@router.get("/{machine_id}/readings", response_model=List[schemas.ReadingItem])
def get_machine_readings(
    machine_id: str,
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db)
):
    if machine_id.isdigit():
        machine = db.query(models.Machine).filter(models.Machine.id == int(machine_id)).first()
    else:
        machine = db.query(models.Machine).filter(models.Machine.machine_code == machine_id).first()

    if not machine:
        raise HTTPException(status_code=404, detail=f"Machine '{machine_id}' not found.")

    readings = (
        db.query(models.SensorReading)
        .filter(models.SensorReading.machine_id == machine.id)
        .order_by(desc(models.SensorReading.timestamp))
        .limit(limit)
        .all()
    )
    return [schemas.ReadingItem.model_validate(r) for r in reversed(readings)]
