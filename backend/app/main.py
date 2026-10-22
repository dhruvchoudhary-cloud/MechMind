import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import init_db, SessionLocal
from app.services.ml_detector import ml_detector
from app.services.maintenance_agent import maintenance_agent
from app import models, schemas
from app.api import (
    machines,
    telemetry,
    alerts,
    tasks,
    dashboard,
    simulator,
    settings as settings_api
)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("predict_before_failure")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Initializing database and loading persisted thresholds...")
    init_db()

    logger.info("Initializing ML detector pipeline...")
    ml_detector.reload()

    # Seed baseline initial readings if database has none
    db = SessionLocal()
    try:
        readings_count = db.query(models.SensorReading).count()
        if readings_count == 0:
            logger.info("Database has no readings. Seeding baseline telemetry for demo...")
            from simulator.sensor_simulator import simulator as sim
            baseline_ticks = sim.generate_tick()
            for r in baseline_ticks:
                payload = schemas.TelemetryPayload(**r)
                maintenance_agent.process_reading(db, payload)
            logger.info("Seeded initial baseline telemetry.")
    except Exception as e:
        logger.warning(f"Initial baseline seeding error: {e}")
    finally:
        db.close()

    yield
    # Shutdown
    from simulator.sensor_simulator import simulator as sim
    sim.stop_loop()
    logger.info("Shutting down MechMind API server...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Autonomous Predictive Maintenance Agent with Hybrid Rule + Isolation Forest Detection.",
    lifespan=lifespan
)

from fastapi import Request
from fastapi.responses import JSONResponse

# Strict CORS configuration (Issue 5 & 26)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

import math
from fastapi.exceptions import RequestValidationError

# Sanitized 422 Handler (prevents ValueError when errors contain non-compliant float NaN/Infinity)
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    def sanitize(obj):
        if isinstance(obj, float):
            if math.isnan(obj) or math.isinf(obj):
                return str(obj)
            return obj
        elif isinstance(obj, (Exception, BaseException)):
            return str(obj)
        elif isinstance(obj, dict):
            return {str(k): sanitize(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [sanitize(v) for v in obj]
        elif not isinstance(obj, (int, bool, str, type(None))):
            return str(obj)
        return obj

    sanitized = sanitize(exc.errors())
    return JSONResponse(
        status_code=422,
        content={"detail": sanitized}
    )

# Global 500 Handler (hides internal exceptions/stack traces from clients)
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server exception on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

# Health endpoint at root and under api v1
@app.get("/health", tags=["Health"])
@app.get(f"{settings.API_V1_PREFIX}/health", tags=["Health"])
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "demo_mode": settings.DEMO_MODE,
        "ml_status": "loaded" if ml_detector.is_loaded else "fallback_mode",
        "model_version": ml_detector.model_version,
        "trained_sklearn_version": ml_detector.trained_sklearn_version
    }

# Include API Routers under /api/v1
app.include_router(dashboard.router, prefix=settings.API_V1_PREFIX)
app.include_router(machines.router, prefix=settings.API_V1_PREFIX)
app.include_router(telemetry.router, prefix=settings.API_V1_PREFIX)
app.include_router(alerts.router, prefix=settings.API_V1_PREFIX)
app.include_router(tasks.router, prefix=settings.API_V1_PREFIX)
app.include_router(simulator.router, prefix=settings.API_V1_PREFIX)
app.include_router(settings_api.router, prefix=settings.API_V1_PREFIX)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
