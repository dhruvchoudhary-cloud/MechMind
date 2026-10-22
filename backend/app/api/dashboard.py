from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app import models, schemas
from app.api.machines import get_machine_summary
from app.api.alerts import format_alert
from app.api.tasks import format_task

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/summary", response_model=schemas.DashboardSummaryResponse)
def get_dashboard_summary(db: Session = Depends(get_db)):
    """
    Returns real-time aggregated fleet statistics, health distribution,
    active alerts, open maintenance tasks, and recent activity.
    """
    machines = db.query(models.Machine).all()
    machine_summaries = [get_machine_summary(m, db) for m in machines]

    total_machines = len(machine_summaries)
    healthy_count = sum(1 for m in machine_summaries if m.risk_level == "low")
    warning_count = sum(1 for m in machine_summaries if m.risk_level == "medium")
    critical_count = sum(1 for m in machine_summaries if m.risk_level in ["high", "critical"])

    health_dist = {
        "low": sum(1 for m in machine_summaries if m.risk_level == "low"),
        "medium": sum(1 for m in machine_summaries if m.risk_level == "medium"),
        "high": sum(1 for m in machine_summaries if m.risk_level == "high"),
        "critical": sum(1 for m in machine_summaries if m.risk_level == "critical")
    }

    active_alerts_cnt = (
        db.query(models.Alert)
        .filter(models.Alert.status.in_(["active", "acknowledged"]))
        .count()
    )

    open_tasks_cnt = (
        db.query(models.MaintenanceTask)
        .filter(models.MaintenanceTask.status.in_(["open", "in_progress"]))
        .count()
    )

    recent_alerts_raw = (
        db.query(models.Alert)
        .order_by(desc(models.Alert.last_seen_at))
        .limit(6)
        .all()
    )
    recent_alerts = [format_alert(a) for a in recent_alerts_raw]

    recent_tasks_raw = (
        db.query(models.MaintenanceTask)
        .order_by(desc(models.MaintenanceTask.created_at))
        .limit(6)
        .all()
    )
    recent_tasks = [format_task(t) for t in recent_tasks_raw]

    # Generate unified activity stream
    recent_activity: List[Dict[str, Any]] = []
    for a in recent_alerts[:4]:
        recent_activity.append({
            "id": f"alert-{a.id}",
            "type": "ALERT",
            "title": f"Alert {a.severity.upper()}: {a.alert_type}",
            "machine": a.machine_code,
            "description": a.description,
            "status": a.status,
            "timestamp": schemas.serialize_utc(a.last_seen_at)
        })
    for t in recent_tasks[:4]:
        recent_activity.append({
            "id": f"task-{t.id}",
            "type": "TASK",
            "title": f"Task Assigned: {t.title}",
            "machine": t.machine_code,
            "description": t.description[:90] + ("..." if len(t.description) > 90 else ""),
            "status": t.status,
            "timestamp": schemas.serialize_utc(t.created_at)
        })

    recent_activity.sort(key=lambda x: x["timestamp"], reverse=True)

    return schemas.DashboardSummaryResponse(
        total_machines=total_machines,
        healthy_machines=healthy_count,
        warning_machines=warning_count,
        critical_machines=critical_count,
        active_alerts=active_alerts_cnt,
        open_maintenance_tasks=open_tasks_cnt,
        health_distribution=health_dist,
        machines=machine_summaries,
        recent_alerts=recent_alerts,
        recent_tasks=recent_tasks,
        recent_activity=recent_activity[:10]
    )
