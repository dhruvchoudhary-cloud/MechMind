from typing import List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app import models, schemas
from app.utils import utc_now

router = APIRouter(prefix="/alerts", tags=["Alerts"])

VALID_ALERT_TRANSITIONS = {
    "active": ["acknowledged", "resolved"],
    "acknowledged": ["resolved"],
    "resolved": []  # Terminal state
}

def format_alert(alert: models.Alert) -> schemas.AlertResponse:
    return schemas.AlertResponse(
        id=alert.id,
        machine_id=alert.machine_id,
        machine_code=alert.machine.machine_code if alert.machine else "UNKNOWN",
        machine_name=alert.machine.name if alert.machine else "Unknown Machine",
        prediction_id=alert.prediction_id,
        alert_type=alert.alert_type,
        severity=alert.severity,
        description=alert.description,
        status=alert.status,
        deduplication_key=alert.deduplication_key,
        first_seen_at=alert.first_seen_at,
        last_seen_at=alert.last_seen_at,
        resolved_at=alert.resolved_at,
        task_id=alert.task.id if alert.task else None
    )

@router.get("", response_model=Union[schemas.PaginatedAlerts, List[schemas.AlertResponse]])
def list_alerts(
    status: Optional[str] = Query(None, description="Filter by status: active, acknowledged, resolved"),
    severity: Optional[str] = Query(None, description="Filter by severity: low, medium, high, critical"),
    machine_id: Optional[str] = Query(None, description="Filter by machine code or ID"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    envelope: bool = Query(False, description="Return {items, total} paginated envelope"),
    db: Session = Depends(get_db)
):
    query = db.query(models.Alert).join(models.Machine)
    if status:
        query = query.filter(models.Alert.status == status)
    if severity:
        query = query.filter(models.Alert.severity == severity)
    if machine_id:
        if machine_id.isdigit():
            query = query.filter(models.Alert.machine_id == int(machine_id))
        else:
            query = query.filter(models.Machine.machine_code == machine_id)

    total_count = query.count()
    alerts = query.order_by(desc(models.Alert.last_seen_at)).offset(offset).limit(limit).all()
    formatted = [format_alert(a) for a in alerts]
    
    if envelope:
        return schemas.PaginatedAlerts(items=formatted, total=total_count, limit=limit, offset=offset)
    return formatted


@router.get("/{alert_id}", response_model=schemas.AlertResponse)
def get_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Alert with ID {alert_id} not found.")
    return format_alert(alert)


@router.patch("/{alert_id}", response_model=schemas.AlertResponse)
def update_alert(alert_id: int, update_data: schemas.AlertUpdate, db: Session = Depends(get_db)):
    alert = db.query(models.Alert).filter(models.Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Alert with ID {alert_id} not found.")

    if update_data.status != alert.status:
        allowed = VALID_ALERT_TRANSITIONS.get(alert.status, [])
        if update_data.status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid alert status transition from '{alert.status}' to '{update_data.status}'. Allowed transitions: {allowed}"
            )

        alert.status = update_data.status
        now = utc_now()
        if update_data.status == "resolved":
            alert.resolved_at = now
            # Synchronize associated task: auto-complete if still open/in_progress
            if alert.task and alert.task.status in ["open", "in_progress"]:
                alert.task.status = "completed"
                alert.task.completed_at = now
                transition_note = f"\n[{now.strftime('%Y-%m-%d %H:%M:%S UTC')}] Auto-completed upon operator resolution of Alert #{alert.id}."
                alert.task.notes = (alert.task.notes or "") + transition_note

    db.commit()
    db.refresh(alert)
    return format_alert(alert)
