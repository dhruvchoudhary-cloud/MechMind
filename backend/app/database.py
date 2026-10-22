import json
import logging
from sqlalchemy import create_engine, event
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.config import settings

logger = logging.getLogger(__name__)

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {}
)

# Enable foreign keys for SQLite
@event.listens_for(engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    if "sqlite" in settings.DATABASE_URL:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def check_and_migrate_db():
    """Auto-heals older database schemas by adding missing columns to existing SQLite tables."""
    from sqlalchemy import text
    try:
        with engine.connect() as conn:
            table_check = conn.execute(text("SELECT name FROM sqlite_master WHERE type='table' AND name='machines'")).fetchone()
            if table_check:
                cols_res = conn.execute(text("PRAGMA table_info(machines)"))
                cols = {row[1] for row in cols_res.fetchall()}
                if "custom_temp_limit_c" not in cols:
                    conn.execute(text("ALTER TABLE machines ADD COLUMN custom_temp_limit_c FLOAT"))
                    logger.info("[Database] Auto-migrated 'machines.custom_temp_limit_c' column.")
                if "custom_vib_limit_rms" not in cols:
                    conn.execute(text("ALTER TABLE machines ADD COLUMN custom_vib_limit_rms FLOAT"))
                    logger.info("[Database] Auto-migrated 'machines.custom_vib_limit_rms' column.")
                if "nominal_rpm" not in cols:
                    conn.execute(text("ALTER TABLE machines ADD COLUMN nominal_rpm FLOAT"))
                    logger.info("[Database] Auto-migrated 'machines.nominal_rpm' column.")
                conn.commit()
    except Exception as e:
        logger.warning(f"[Database] Auto-migration check: {e}")

def init_db():
    from app import models
    check_and_migrate_db()
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Load persisted settings if available (Issue 3 & 23)
        persisted_settings = db.query(models.SystemSetting).filter(models.SystemSetting.key == "thresholds").first()
        if persisted_settings:
            try:
                data = json.loads(persisted_settings.value_json)
                for k, v in data.items():
                    if hasattr(settings, k.upper()):
                        setattr(settings, k.upper(), v)
                logger.info("[Database] Loaded persisted threshold settings from database.")
            except Exception as e:
                logger.warning(f"[Database] Could not parse persisted settings: {e}")

        # Seed initial machines (custom limits None by default so global settings govern the fleet)
        initial_machines = [
            {
                "machine_code": "motor-001",
                "name": "Assembly Line Motor",
                "machine_type": "Induction Motor",
                "location": "Line A - Stamping Bay",
                "criticality": "HIGH",
                "status": "ACTIVE",
                "custom_temp_limit_c": None,
                "custom_vib_limit_rms": None,
                "nominal_rpm": 1485.0
            },
            {
                "machine_code": "motor-002",
                "name": "Conveyor Motor",
                "machine_type": "Continuous Duty Motor",
                "location": "Warehouse Conveyor 3",
                "criticality": "MEDIUM",
                "status": "ACTIVE",
                "custom_temp_limit_c": None,
                "custom_vib_limit_rms": None,
                "nominal_rpm": 1440.0
            },
            {
                "machine_code": "motor-003",
                "name": "Cooling Pump Motor",
                "machine_type": "Submersible Centrifugal Motor",
                "location": "Main Chiller Plant",
                "criticality": "HIGH",
                "status": "ACTIVE",
                "custom_temp_limit_c": None,
                "custom_vib_limit_rms": None,
                "nominal_rpm": 1750.0
            }
        ]
        
        for m_data in initial_machines:
            existing = db.query(models.Machine).filter(models.Machine.machine_code == m_data["machine_code"]).first()
            if not existing:
                machine = models.Machine(**m_data)
                db.add(machine)
        db.commit()
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()
