from typing import List, Optional, Union
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app import models, schemas
from app.utils import utc_now

router = APIRouter(prefix="/tasks", tags=["Maintenance Tasks"])

VALID_TASK_TRANSITIONS = {
    "open": ["in_progress", "cancelled"],
    "in_progress": ["completed", "cancelled"],
    "completed": [],  # Terminal state
    "cancelled": []   # Terminal state
}

def format_task(task: models.MaintenanceTask) -> schemas.MaintenanceTaskResponse:
    return schemas.MaintenanceTaskResponse(
        id=task.id,
        machine_id=task.machine_id,
        machine_code=task.machine.machine_code if task.machine else "UNKNOWN",
        machine_name=task.machine.name if task.machine else "Unknown Machine",
        alert_id=task.alert_id,
        title=task.title,
        description=task.description,
        priority=task.priority,
        recommendation=task.recommendation,
        status=task.status,
        notes=task.notes,
        created_at=task.created_at,
        completed_at=task.completed_at
    )

@router.get("", response_model=Union[schemas.PaginatedTasks, List[schemas.MaintenanceTaskResponse]])
def list_tasks(
    status: Optional[str] = Query(None, description="Filter by status: open, in_progress, completed, cancelled"),
    priority: Optional[str] = Query(None, description="Filter by priority: low, medium, high, critical"),
    machine_id: Optional[str] = Query(None, description="Filter by machine code or ID"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0, description="Offset for pagination"),
    envelope: bool = Query(False, description="Return {items, total} paginated envelope"),
    db: Session = Depends(get_db)
):
    query = db.query(models.MaintenanceTask).join(models.Machine)
    if status:
        query = query.filter(models.MaintenanceTask.status == status)
    if priority:
        query = query.filter(models.MaintenanceTask.priority == priority)
    if machine_id:
        if machine_id.isdigit():
            query = query.filter(models.MaintenanceTask.machine_id == int(machine_id))
        else:
            query = query.filter(models.Machine.machine_code == machine_id)

    total_count = query.count()
    tasks = query.order_by(desc(models.MaintenanceTask.created_at)).offset(offset).limit(limit).all()
    priority_weights = {"critical": 4, "high": 3, "medium": 2, "low": 1}
    tasks.sort(key=lambda t: priority_weights.get(t.priority.lower(), 0), reverse=True)
    formatted = [format_task(t) for t in tasks]

    if envelope:
        return schemas.PaginatedTasks(items=formatted, total=total_count, limit=limit, offset=offset)
    return formatted


@router.get("/{task_id}", response_model=schemas.MaintenanceTaskResponse)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(models.MaintenanceTask).filter(models.MaintenanceTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Task with ID {task_id} not found.")
    return format_task(task)


@router.patch("/{task_id}", response_model=schemas.MaintenanceTaskResponse)
def update_task(task_id: int, update_data: schemas.MaintenanceTaskUpdate, db: Session = Depends(get_db)):
    task = db.query(models.MaintenanceTask).filter(models.MaintenanceTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Task with ID {task_id} not found.")

    now = utc_now()

    if update_data.status and update_data.status != task.status:
        allowed = VALID_TASK_TRANSITIONS.get(task.status, [])
        if update_data.status not in allowed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid task status transition from '{task.status}' to '{update_data.status}'. Allowed transitions: {allowed}"
            )
        
        old_status = task.status
        task.status = update_data.status
        transition_note = f"\n[{now.strftime('%Y-%m-%d %H:%M:%S UTC')}] Status changed from '{old_status}' to '{update_data.status}'."
        task.notes = (task.notes or "") + transition_note

        if update_data.status == "completed":
            task.completed_at = now
            # Synchronize associated alert: mark resolved
            if task.alert and task.alert.status != "resolved":
                task.alert.status = "resolved"
                task.alert.resolved_at = now

    if update_data.notes is not None and update_data.notes != task.notes:
        task.notes = update_data.notes

    db.commit()
    db.refresh(task)
    return format_task(task)
