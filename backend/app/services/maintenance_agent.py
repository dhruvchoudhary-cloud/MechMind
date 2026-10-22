import json
import datetime
import logging
from typing import Optional, Dict, Any, Tuple
from sqlalchemy.orm import Session

from app import models, schemas
from app.config import settings
from app.utils import utc_now
from app.services.rules import rule_engine
from app.services.ml_detector import ml_detector
from app.services.risk_engine import risk_engine

logger = logging.getLogger(__name__)

class AutonomousMaintenanceAgent:
    """
    Deterministic maintenance agent workflow:
    Evaluates readings -> ML inference -> Risk Assessment -> Alert Deduplication -> Task Generation -> Recovery Auto-Resolution.
    """

    def determine_incident_key_and_type(
        self,
        machine_code: str,
        rule_violations: list,
        ml_anomaly: bool,
        risk_level: str
    ) -> Tuple[str, str, str]:
        has_temp = any(v.get("feature_name") == "temperature_c" for v in rule_violations)
        has_vib = any(v.get("feature_name") == "vibration_mm_s_rms" for v in rule_violations)
        has_curr = any(v.get("feature_name") == "current_a" for v in rule_violations)
        has_rpm = any(v.get("feature_name") == "rpm" for v in rule_violations)

        if has_temp and has_vib:
            alert_type = "COMBINED_FAULT"
            sub_key = "combined_thermo_mechanical"
            summary = "Simultaneous elevated temperature and severe vibration"
        elif has_temp:
            alert_type = "OVERHEATING"
            sub_key = "thermal_overheat"
            summary = "Thermal excursion exceeding safe threshold"
        elif has_vib:
            alert_type = "EXCESSIVE_VIBRATION"
            sub_key = "vibration_anomaly"
            summary = "Vibration RMS velocity exceeding vibration limits"
        elif has_curr:
            alert_type = "CURRENT_ANOMALY"
            sub_key = "current_out_of_bounds"
            summary = "Electrical current draw outside normal operating envelope"
        elif has_rpm:
            alert_type = "RPM_ANOMALY"
            sub_key = "rpm_out_of_bounds"
            summary = "Rotor RPM deviating from expected operational speed"
        elif ml_anomaly:
            alert_type = "ML_MULTIVARIATE_ANOMALY"
            sub_key = "isolation_forest_outlier"
            summary = "Isolation Forest flagged abnormal multivariate correlation"
        else:
            alert_type = "ELEVATED_RISK"
            sub_key = "risk_score_spike"
            summary = f"Elevated machine health risk score ({risk_level})"

        dedup_key = f"{machine_code}:{sub_key}"
        return alert_type, dedup_key, summary

    def build_recommendation(
        self,
        alert_type: str,
        possible_causes: list,
        risk_level: str
    ) -> str:
        steps = []
        if alert_type == "COMBINED_FAULT":
            steps.append("1. Immediately inspect motor drive-end and non-drive-end bearings for thermal discolouration or grease carbonization.")
            steps.append("2. Perform acoustic ultrasound check for bearing race spalling or cage disintegration.")
            steps.append("3. Verify shaft laser alignment and motor hold-down bolt torque.")
            steps.append("4. Measure cooling fan airflow and verify motor casing fins are free from debris.")
        elif alert_type == "OVERHEATING":
            steps.append("1. Inspect motor cooling fan shroud and heat dissipation fins for blockages.")
            steps.append("2. Verify ambient enclosure temperature and cooling air supply.")
            steps.append("3. Check bearing lubricant viscosity and grease degradation level.")
            steps.append("4. Measure winding resistance with a micro-ohmmeter to rule out inter-turn short.")
        elif alert_type == "EXCESSIVE_VIBRATION":
            steps.append("1. Perform vibration spectrum analysis (FFT) to differentiate 1X unbalance from 2X misalignment or defect frequencies.")
            steps.append("2. Inspect flexible coupling element for backlash or elastomer wear.")
            steps.append("3. Inspect foundation anchor bolts for mechanical looseness or soft foot.")
        elif alert_type == "CURRENT_ANOMALY":
            steps.append("1. Measure 3-phase supply voltage balance at motor terminal box.")
            steps.append("2. Perform insulation resistance (megger) test from windings to ground.")
            steps.append("3. Check driven mechanical load for mechanical binding, belt jam, or impeller cavitation.")
        else:
            steps.append("1. Perform visual inspection of motor enclosure, cabling, and mounting.")
            steps.append("2. Review telemetry trends over previous 4-hour cycle.")
            steps.append("3. Re-sample vibration and temperature under full production load.")

        causes_text = ("Suspected Hypotheses: " + "; ".join(possible_causes) + ".\n") if possible_causes else ""
        return f"{causes_text}Recommended Action Plan:\n" + "\n".join(steps)

    def process_reading(
        self,
        db: Session,
        payload: schemas.TelemetryPayload
    ) -> schemas.HealthAssessmentResponse:
        """
        Executes the full end-to-end autonomous maintenance workflow.
        """
        now = utc_now()

        # Step 1: Find machine
        machine = db.query(models.Machine).filter(
            models.Machine.machine_code == payload.machine_id
        ).first()

        if not machine:
            raise ValueError(f"Machine with code '{payload.machine_id}' does not exist.")

        # Step 2: Quality & Stale Check (Issue 14 & 22)
        reading_time = payload.timestamp
        if reading_time is None:
            reading_time = now
        elif reading_time.tzinfo is None:
            reading_time = reading_time.replace(tzinfo=datetime.timezone.utc)

        time_diff = (now - reading_time).total_seconds()
        quality_status = "VALID"
        if time_diff > settings.STALE_TELEMETRY_THRESHOLD_SEC:
            quality_status = "STALE"

        # Store sensor reading
        reading = models.SensorReading(
            machine_id=machine.id,
            timestamp=reading_time,
            ingested_at=now,
            temperature_c=payload.temperature_c,
            vibration_mm_s_rms=payload.vibration_mm_s_rms,
            current_a=payload.current_a,
            rpm=payload.rpm,
            quality_status=quality_status
        )
        db.add(reading)
        db.flush()

        # Step 3: Evaluate limits using machine custom thresholds if available (Issue 17)
        rule_score, rule_violations, possible_causes = rule_engine.evaluate(
            temperature_c=payload.temperature_c,
            vibration_mm_s_rms=payload.vibration_mm_s_rms,
            current_a=payload.current_a,
            rpm=payload.rpm,
            custom_temp_limit_c=machine.custom_temp_limit_c,
            custom_vib_limit_rms=machine.custom_vib_limit_rms,
            nominal_rpm=machine.nominal_rpm
        )

        # Step 4: ML Anomaly Detection (Isolation Forest)
        ml_anomaly, ml_score, model_version = ml_detector.predict(
            temperature_c=payload.temperature_c,
            vibration_mm_s_rms=payload.vibration_mm_s_rms,
            current_a=payload.current_a,
            rpm=payload.rpm
        )

        if ml_anomaly and not possible_causes:
            possible_causes.append("Multivariate anomaly: parameter relationship deviates from baseline operational profile")

        # Check if machine is stopped / standby (0 A and 0 RPM)
        if payload.current_a < 0.5 and payload.rpm < 50.0:
            ml_anomaly = False

        # Step 5: Hybrid Risk Scoring
        risk_score, risk_level, evidence = risk_engine.calculate_risk(
            rule_score=rule_score,
            rule_violations=rule_violations,
            ml_anomaly=ml_anomaly,
            ml_score=ml_score,
            model_version=model_version,
            possible_causes=possible_causes
        )

        # Step 6: Persist Prediction & Evidence
        prediction = models.Prediction(
            machine_id=machine.id,
            reading_id=reading.id,
            risk_score=risk_score,
            risk_level=risk_level,
            rule_score=rule_score,
            ml_anomaly=ml_anomaly,
            ml_score=ml_score,
            model_version=model_version,
            evidence_json=json.dumps({
                "evidence": evidence,
                "possible_causes": possible_causes,
                "rule_violations": rule_violations,
                "quality_status": quality_status
            }),
            created_at=now
        )
        db.add(prediction)
        db.flush()

        # Step 7: Recovery Policy Handling with Hysteresis (Issue 6 & 15)
        # Require 3 consecutive normal readings before resolving to prevent flapping
        is_normal = (risk_level == "low" and len(rule_violations) == 0 and not ml_anomaly)
        if not hasattr(self, "_consecutive_normal"):
            self._consecutive_normal = {}
        
        if is_normal:
            self._consecutive_normal[machine.machine_code] = self._consecutive_normal.get(machine.machine_code, 0) + 1
        else:
            self._consecutive_normal[machine.machine_code] = 0

        if settings.AUTO_RESOLVE_ON_RECOVERY and self._consecutive_normal.get(machine.machine_code, 0) >= 3:
            active_alerts = db.query(models.Alert).filter(
                models.Alert.machine_id == machine.id,
                models.Alert.status.in_(["active", "acknowledged"])
            ).all()
            for al in active_alerts:
                al.status = "resolved"
                al.resolved_at = now
                al.description += " [Auto-resolved: Confirmed recovery to nominal limits]"
                if al.task and al.task.status in ["open", "in_progress"]:
                    al.task.status = "completed"
                    al.task.completed_at = now
                    recovery_note = f"\n[{now.strftime('%Y-%m-%d %H:%M:%S UTC')}] Auto-completed: Telemetry confirmed stabilized within normal limits."
                    al.task.notes = (al.task.notes or "") + recovery_note

        # Step 8: Alert Generation & Deduplication Logic
        new_alert_created = False
        task_created = False
        active_alert_id = None
        generated_task_id = None

        # Alerts and tasks require elevated risk (MEDIUM+) or rule threshold violations
        # Low-risk ML anomalies without violations are logged in evidence but do not generate alerts/tasks
        qualifies_for_alert = (
            risk_level in ["medium", "high", "critical"]
            or len(rule_violations) > 0
        )

        if qualifies_for_alert:
            alert_type, dedup_key, summary = self.determine_incident_key_and_type(
                machine_code=machine.machine_code,
                rule_violations=rule_violations,
                ml_anomaly=ml_anomaly,
                risk_level=risk_level
            )

            # Check for existing active or acknowledged alert for this machine (One active incident per machine)
            existing_alert = db.query(models.Alert).filter(
                models.Alert.machine_id == machine.id,
                models.Alert.status.in_(["active", "acknowledged"])
            ).first()

            severity_order = {"low": 1, "medium": 2, "high": 3, "critical": 4}

            if existing_alert:
                # Update/escalate existing incident in place
                existing_alert.last_seen_at = now
                existing_alert.prediction_id = prediction.id
                
                # Escalate to COMBINED_FAULT if both thermo and mechanical faults are active
                if alert_type == "COMBINED_FAULT" and existing_alert.alert_type != "COMBINED_FAULT":
                    existing_alert.alert_type = "COMBINED_FAULT"
                    existing_alert.description = f"{summary} (Risk Score: {risk_score:.0f}/100)"

                if severity_order.get(risk_level, 1) > severity_order.get(existing_alert.severity, 1):
                    existing_alert.severity = risk_level
                    existing_alert.description = f"[Elevated] {summary} (Risk: {risk_score:.0f}/100)"

                active_alert_id = existing_alert.id
                if existing_alert.task:
                    generated_task_id = existing_alert.task.id
                    if severity_order.get(risk_level, 1) > severity_order.get(existing_alert.task.priority, 1):
                        existing_alert.task.priority = risk_level
                        formatted_type = existing_alert.alert_type.replace('_', ' ').title().replace('Ml ', 'ML ')
                        existing_alert.task.title = f"[{risk_level.upper()}] Maintenance: {machine.name} - {formatted_type}"
            else:
                # Create NEW Alert (exactly ONE active incident per machine)
                new_alert = models.Alert(
                    machine_id=machine.id,
                    prediction_id=prediction.id,
                    alert_type=alert_type,
                    severity=risk_level,
                    description=f"{summary} (Risk Score: {risk_score:.0f}/100)",
                    status="active",
                    deduplication_key=dedup_key,
                    first_seen_at=now,
                    last_seen_at=now
                )
                db.add(new_alert)
                db.flush()
                new_alert_created = True
                active_alert_id = new_alert.id

                # Automatically create ONE Maintenance Task
                formatted_type = alert_type.replace('_', ' ').title().replace('Ml ', 'ML ')
                task_title = f"[{risk_level.upper()}] Maintenance: {machine.name} - {formatted_type}"
                recommendation_text = self.build_recommendation(alert_type, possible_causes, risk_level)
                
                causes_summary = "; ".join(possible_causes) if possible_causes else "Abnormal sensor telemetry detected."
                task_desc = (
                    f"Automated maintenance dispatch for {machine.name} ({machine.machine_code}) at {machine.location}.\n"
                    f"Risk Score: {risk_score:.1f}/100 ({risk_level.upper()}).\n"
                    f"Suspected Causes: {causes_summary}.\n"
                    f"Observed: Temp={payload.temperature_c:.1f}°C, Vib={payload.vibration_mm_s_rms:.2f}mm/s, "
                    f"Current={payload.current_a:.2f}A, RPM={payload.rpm:.0f}."
                )

                new_task = models.MaintenanceTask(
                    machine_id=machine.id,
                    alert_id=new_alert.id,
                    title=task_title,
                    description=task_desc,
                    priority=risk_level,
                    recommendation=recommendation_text,
                    status="open",
                    created_at=now
                )
                db.add(new_task)
                db.flush()
                task_created = True
                generated_task_id = new_task.id

        db.commit()

        return schemas.HealthAssessmentResponse(
            machine_code=machine.machine_code,
            machine_name=machine.name,
            risk_score=risk_score,
            risk_level=risk_level,
            rule_score=rule_score,
            ml_anomaly=ml_anomaly,
            ml_score=ml_score,
            model_version=model_version,
            evidence=evidence,
            possible_causes=possible_causes,
            new_alert_created=new_alert_created,
            active_alert_id=active_alert_id,
            task_created=task_created,
            generated_task_id=generated_task_id,
            reading_id=reading.id,
            timestamp=reading_time
        )

maintenance_agent = AutonomousMaintenanceAgent()
