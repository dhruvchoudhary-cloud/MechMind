from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app import schemas
from app.services.maintenance_agent import maintenance_agent

router = APIRouter(prefix="/telemetry", tags=["Telemetry"])

@router.post("", response_model=schemas.HealthAssessmentResponse, status_code=status.HTTP_201_CREATED)
def ingest_telemetry(payload: schemas.TelemetryPayload, db: Session = Depends(get_db)):
    """
    Ingests high-frequency machine telemetry, runs rule evaluation and ML anomaly detection,
    computes hybrid risk score, and triggers autonomous maintenance workflows.
    """
    try:
        assessment = maintenance_agent.process_reading(db, payload)
        return assessment
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(ve))
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Failed to ingest telemetry: {e}", exc_info=True)
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Internal server error during telemetry ingestion")
