import math
import datetime
from typing import Optional, List, Any, Dict, Annotated
from pydantic import BaseModel, Field, field_validator, model_validator, ConfigDict, PlainSerializer

# Serializer that guarantees ISO-8601 formatting with trailing 'Z' for UTC
def serialize_utc(dt: Optional[datetime.datetime]) -> Optional[str]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=datetime.timezone.utc)
    else:
        dt = dt.astimezone(datetime.timezone.utc)
    # Output e.g. 2026-10-22T17:12:34.567Z
    return dt.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

_serialize_utc = serialize_utc
UtcDatetime = Annotated[datetime.datetime, PlainSerializer(serialize_utc, return_type=str)]
OptionalUtcDatetime = Annotated[Optional[datetime.datetime], PlainSerializer(serialize_utc, return_type=Optional[str])]

# --- Telemetry Ingestion ---
class TelemetryPayload(BaseModel):
    machine_id: str = Field(..., description="Machine code identifier (e.g. motor-001)")
    timestamp: Optional[datetime.datetime] = None
    temperature_c: float = Field(..., ge=-50.0, le=250.0, description="Temperature in Celsius")
    vibration_mm_s_rms: float = Field(..., ge=0.0, le=100.0, description="Vibration velocity RMS in mm/s")
    current_a: float = Field(..., ge=0.0, le=200.0, description="Electric current in Amperes")
    rpm: float = Field(..., ge=0.0, le=20000.0, description="Rotational speed in RPM")

    @field_validator("machine_id")
    @classmethod
    def validate_machine_id(cls, v: str) -> str:
        v_clean = v.strip()
        if not v_clean:
            raise ValueError("machine_id cannot be empty")
        return v_clean

    @field_validator("temperature_c", "vibration_mm_s_rms", "current_a", "rpm")
    @classmethod
    def validate_finite(cls, v: float, info) -> float:
        if not math.isfinite(v):
            raise ValueError(f"{info.field_name} must be a finite number (NaN and Infinity not permitted)")
        return v

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp(cls, v: Optional[datetime.datetime]) -> Optional[datetime.datetime]:
        if v is not None:
            now_utc = datetime.datetime.now(datetime.timezone.utc)
            v_utc = v if v.tzinfo is not None else v.replace(tzinfo=datetime.timezone.utc)
            if v_utc > now_utc + datetime.timedelta(seconds=60):
                raise ValueError("Timestamp cannot be in the future (> 60s ahead)")
            if v_utc < now_utc - datetime.timedelta(hours=24):
                raise ValueError("Timestamp is too old (> 24 hours)")
            return v_utc
        return v


class RuleViolationItem(BaseModel):
    feature_name: str
    observed_value: float
    configured_limit: float
    violation_type: str  # upper_bound, lower_bound
    severity: str        # warning, critical


class HealthAssessmentResponse(BaseModel):
    machine_code: str
    machine_name: str
    risk_score: float
    risk_level: str      # low, medium, high, critical
    rule_score: float
    ml_anomaly: bool
    ml_score: Optional[float] = None
    model_version: str
    evidence: List[Dict[str, Any]]
    possible_causes: List[str]
    new_alert_created: bool = False
    active_alert_id: Optional[int] = None
    task_created: bool = False
    generated_task_id: Optional[int] = None
    reading_id: int
    timestamp: UtcDatetime


# --- Machine Schemas ---
class MachineSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    machine_code: str
    name: str
    machine_type: str
    location: str
    criticality: str
    status: str
    created_at: UtcDatetime
    latest_temperature: Optional[float] = None
    latest_vibration: Optional[float] = None
    latest_current: Optional[float] = None
    latest_rpm: Optional[float] = None
    latest_reading_time: OptionalUtcDatetime = None
    risk_score: float = 0.0
    risk_level: str = "low"
    active_alert_count: int = 0
    is_stale: bool = False


class ReadingItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    timestamp: UtcDatetime
    temperature_c: float
    vibration_mm_s_rms: float
    current_a: float
    rpm: float
    quality_status: str


# --- Alert Schemas ---
class AlertResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    machine_id: int
    machine_code: str
    machine_name: str
    prediction_id: Optional[int] = None
    alert_type: str
    severity: str
    description: str
    status: str
    deduplication_key: str
    first_seen_at: UtcDatetime
    last_seen_at: UtcDatetime
    resolved_at: OptionalUtcDatetime = None
    task_id: Optional[int] = None


class AlertUpdate(BaseModel):
    status: str = Field(..., pattern="^(active|acknowledged|resolved)$")


# --- Maintenance Task Schemas ---
class MaintenanceTaskResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    machine_id: int
    machine_code: str
    machine_name: str
    alert_id: int
    title: str
    description: str
    priority: str
    recommendation: str
    status: str
    notes: Optional[str] = None
    created_at: UtcDatetime
    completed_at: OptionalUtcDatetime = None


class MaintenanceTaskUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern="^(open|in_progress|completed|cancelled)$")
    notes: Optional[str] = None


# --- Machine Detail Schemas ---
class MachineDetailResponse(BaseModel):
    id: int
    machine_code: str
    name: str
    machine_type: str
    location: str
    criticality: str
    status: str
    created_at: UtcDatetime
    current_health: HealthAssessmentResponse
    recent_readings: List[ReadingItem]
    recent_alerts: List[AlertResponse]
    related_tasks: List[MaintenanceTaskResponse]


# --- Paginated Envelopes ---
class PaginatedAlerts(BaseModel):
    items: List[AlertResponse]
    total: int
    limit: Optional[int] = None
    offset: Optional[int] = None

class PaginatedTasks(BaseModel):
    items: List[MaintenanceTaskResponse]
    total: int
    limit: Optional[int] = None
    offset: Optional[int] = None

class PaginatedMachines(BaseModel):
    items: List[MachineSummary]
    total: int
    limit: Optional[int] = None
    offset: Optional[int] = None


# --- Dashboard Schemas ---
class DashboardSummaryResponse(BaseModel):
    total_machines: int
    healthy_machines: int
    warning_machines: int
    critical_machines: int
    active_alerts: int
    open_maintenance_tasks: int
    health_distribution: Dict[str, int]
    machines: List[MachineSummary]
    recent_alerts: List[AlertResponse]
    recent_tasks: List[MaintenanceTaskResponse]
    recent_activity: List[Dict[str, Any]]


# --- Simulator Schemas ---
class ScenarioRequest(BaseModel):
    scenario: str = Field(..., pattern="^(normal|overheating|excessive_vibration|combined_fault|overheating_and_vibration|recovery)$")
    machine_id: Optional[str] = None
    duration_seconds: Optional[float] = Field(None, ge=1.0, le=3600.0)


class SimulatorActionResponse(BaseModel):
    status: str
    message: str
    current_scenario: str
    active_machines: List[str]


# --- Settings Schemas ---
class SystemSettingsModel(BaseModel):
    temp_warning_c: float = Field(..., ge=20.0, le=150.0)
    temp_critical_c: float = Field(..., ge=30.0, le=200.0)
    vibration_warning_rms: float = Field(..., ge=0.5, le=30.0)
    vibration_critical_rms: float = Field(..., ge=1.0, le=50.0)
    current_min_a: float = Field(..., ge=0.0, le=50.0)
    current_max_a: float = Field(..., ge=1.0, le=200.0)
    rpm_min: float = Field(..., ge=100.0, le=10000.0)
    rpm_max: float = Field(..., ge=200.0, le=20000.0)
    simulation_interval_sec: float = Field(..., ge=0.5, le=60.0)
    risk_low_max: int = Field(..., ge=1, le=80)
    risk_medium_max: int = Field(..., ge=5, le=90)
    risk_high_max: int = Field(..., ge=10, le=99)

    @model_validator(mode="after")
    def validate_threshold_relationships(self) -> "SystemSettingsModel":
        if self.temp_warning_c >= self.temp_critical_c:
            raise ValueError(f"temp_warning_c ({self.temp_warning_c}) must be strictly less than temp_critical_c ({self.temp_critical_c})")
        if self.vibration_warning_rms >= self.vibration_critical_rms:
            raise ValueError(f"vibration_warning_rms ({self.vibration_warning_rms}) must be strictly less than vibration_critical_rms ({self.vibration_critical_rms})")
        if self.current_min_a >= self.current_max_a:
            raise ValueError(f"current_min_a ({self.current_min_a}) must be strictly less than current_max_a ({self.current_max_a})")
        if self.rpm_min >= self.rpm_max:
            raise ValueError(f"rpm_min ({self.rpm_min}) must be strictly less than rpm_max ({self.rpm_max})")
        if not (self.risk_low_max < self.risk_medium_max < self.risk_high_max < 100):
            raise ValueError("Risk thresholds must satisfy: risk_low_max < risk_medium_max < risk_high_max < 100")
        return self
