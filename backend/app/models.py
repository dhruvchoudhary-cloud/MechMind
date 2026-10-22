import datetime
from sqlalchemy import (
    Column, Integer, Float, String, Boolean, DateTime, ForeignKey, Text
)
from sqlalchemy.orm import relationship
from app.database import Base
from app.utils import utc_now

class Machine(Base):
    __tablename__ = "machines"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    machine_code = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    machine_type = Column(String(100), nullable=False)
    location = Column(String(100), nullable=False)
    criticality = Column(String(20), default="MEDIUM", nullable=False)
    status = Column(String(20), default="ACTIVE", nullable=False)
    
    # Machine-specific thresholds (Issue 17)
    custom_temp_limit_c = Column(Float, nullable=True)
    custom_vib_limit_rms = Column(Float, nullable=True)
    nominal_rpm = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    readings = relationship("SensorReading", back_populates="machine", cascade="all, delete-orphan")
    predictions = relationship("Prediction", back_populates="machine", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="machine", cascade="all, delete-orphan")
    tasks = relationship("MaintenanceTask", back_populates="machine", cascade="all, delete-orphan")


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    machine_id = Column(Integer, ForeignKey("machines.id", ondelete="CASCADE"), index=True, nullable=False)
    timestamp = Column(DateTime(timezone=True), default=utc_now, index=True, nullable=False)
    ingested_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    temperature_c = Column(Float, nullable=False)
    vibration_mm_s_rms = Column(Float, nullable=False)
    current_a = Column(Float, nullable=False)
    rpm = Column(Float, nullable=False)
    quality_status = Column(String(20), default="VALID", nullable=False)  # VALID, STALE, INVALID

    machine = relationship("Machine", back_populates="readings")
    prediction = relationship("Prediction", back_populates="reading", uselist=False, cascade="all, delete-orphan")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    machine_id = Column(Integer, ForeignKey("machines.id", ondelete="CASCADE"), index=True, nullable=False)
    reading_id = Column(Integer, ForeignKey("sensor_readings.id", ondelete="CASCADE"), nullable=True, index=True)
    risk_score = Column(Float, nullable=False)
    risk_level = Column(String(20), nullable=False)  # low, medium, high, critical
    rule_score = Column(Float, nullable=False, default=0.0)
    ml_anomaly = Column(Boolean, nullable=False, default=False)
    ml_score = Column(Float, nullable=True)
    model_version = Column(String(50), nullable=False, default="unknown")
    evidence_json = Column(Text, nullable=False)  # JSON-encoded array/dict
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)

    machine = relationship("Machine", back_populates="predictions")
    reading = relationship("SensorReading", back_populates="prediction")
    alerts = relationship("Alert", back_populates="prediction")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    machine_id = Column(Integer, ForeignKey("machines.id", ondelete="CASCADE"), index=True, nullable=False)
    prediction_id = Column(Integer, ForeignKey("predictions.id", ondelete="SET NULL"), nullable=True, index=True)
    alert_type = Column(String(100), nullable=False)
    severity = Column(String(20), nullable=False)  # low, medium, high, critical
    description = Column(String(500), nullable=False)
    status = Column(String(20), default="active", nullable=False)  # active, acknowledged, resolved
    deduplication_key = Column(String(150), index=True, nullable=False)
    first_seen_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    last_seen_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    machine = relationship("Machine", back_populates="alerts")
    prediction = relationship("Prediction", back_populates="alerts")
    task = relationship("MaintenanceTask", back_populates="alert", uselist=False, cascade="all, delete-orphan")


class MaintenanceTask(Base):
    __tablename__ = "maintenance_tasks"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    machine_id = Column(Integer, ForeignKey("machines.id", ondelete="CASCADE"), index=True, nullable=False)
    alert_id = Column(Integer, ForeignKey("alerts.id", ondelete="CASCADE"), unique=True, index=True, nullable=False)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(String(20), nullable=False)  # low, medium, high, critical
    recommendation = Column(Text, nullable=False)
    status = Column(String(20), default="open", nullable=False)  # open, in_progress, completed, cancelled
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    machine = relationship("Machine", back_populates="tasks")
    alert = relationship("Alert", back_populates="task")


class SystemSetting(Base):
    """Persistent storage for configuration settings (Issue 3 & 23)."""
    __tablename__ = "system_settings"

    key = Column(String(100), primary_key=True, index=True)
    value_json = Column(Text, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now, nullable=False)
