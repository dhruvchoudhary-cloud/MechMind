from typing import List, Dict, Any, Tuple, Optional
from app.config import settings

class RuleEngine:
    def __init__(self, config=None):
        self.config = config or settings

    def evaluate(
        self,
        temperature_c: float,
        vibration_mm_s_rms: float,
        current_a: float,
        rpm: float,
        custom_temp_limit_c: Optional[float] = None,
        custom_vib_limit_rms: Optional[float] = None,
        nominal_rpm: Optional[float] = None
    ) -> Tuple[float, List[Dict[str, Any]], List[str]]:
        """
        Evaluates machine readings against configurable rules and machine-specific limits (Issue 17).
        Returns:
            (rule_score, violations, possible_causes)
        """
        violations: List[Dict[str, Any]] = []
        possible_causes: List[str] = []
        score = 0.0

        # Standby / Stopped motor check (0 A and 0 RPM means motor is powered off, not faulted)
        if current_a < 0.5 and rpm < 50.0:
            return 0.0, [], ["Machine in standby / de-energized state"]

        # Effective limits (machine-specific override if explicitly defined, otherwise global settings)
        warn_temp = custom_temp_limit_c if custom_temp_limit_c is not None else self.config.TEMP_WARNING_C
        crit_temp = self.config.TEMP_CRITICAL_C if custom_temp_limit_c is None else max(warn_temp + 10.0, self.config.TEMP_CRITICAL_C)

        warn_vib = custom_vib_limit_rms if custom_vib_limit_rms is not None else self.config.VIBRATION_WARNING_RMS
        crit_vib = self.config.VIBRATION_CRITICAL_RMS if custom_vib_limit_rms is None else max(warn_vib + 2.0, self.config.VIBRATION_CRITICAL_RMS)

        min_rpm = (nominal_rpm * 0.7) if nominal_rpm is not None else self.config.RPM_MIN
        max_rpm = (nominal_rpm * 1.2) if nominal_rpm is not None else self.config.RPM_MAX

        # 1. Temperature check
        if temperature_c >= crit_temp:
            violations.append({
                "feature_name": "temperature_c",
                "observed_value": round(temperature_c, 2),
                "configured_limit": crit_temp,
                "violation_type": "upper_bound",
                "severity": "critical",
                "message": f"Critical overheating detected ({temperature_c:.1f}°C >= {crit_temp:.1f}°C)"
            })
            score += 50.0
            possible_causes.append("Severe cooling circuit failure or severe motor winding overheating")
        elif temperature_c >= warn_temp:
            violations.append({
                "feature_name": "temperature_c",
                "observed_value": round(temperature_c, 2),
                "configured_limit": warn_temp,
                "violation_type": "upper_bound",
                "severity": "warning",
                "message": f"Elevated operating temperature ({temperature_c:.1f}°C >= {warn_temp:.1f}°C)"
            })
            score += 35.0
            possible_causes.append("Cooling airflow restriction, ambient heat load, or lubrication breakdown")

        # 2. Vibration check
        if vibration_mm_s_rms >= crit_vib:
            violations.append({
                "feature_name": "vibration_mm_s_rms",
                "observed_value": round(vibration_mm_s_rms, 2),
                "configured_limit": crit_vib,
                "violation_type": "upper_bound",
                "severity": "critical",
                "message": f"Critical vibration spike ({vibration_mm_s_rms:.2f} mm/s >= {crit_vib:.2f} mm/s)"
            })
            score += 50.0
            possible_causes.append("Impending bearing seizure, severe rotor unbalance, or structural looseness")
        elif vibration_mm_s_rms >= warn_vib:
            violations.append({
                "feature_name": "vibration_mm_s_rms",
                "observed_value": round(vibration_mm_s_rms, 2),
                "configured_limit": warn_vib,
                "violation_type": "upper_bound",
                "severity": "warning",
                "message": f"Excessive vibration detected ({vibration_mm_s_rms:.2f} mm/s >= {warn_vib:.2f} mm/s)"
            })
            score += 35.0
            possible_causes.append("Shaft misalignment, rotor dynamic unbalance, or early race fatigue")

        # Combined thermal + mechanical degradation pattern
        if temperature_c >= warn_temp and vibration_mm_s_rms >= warn_vib:
            possible_causes.append("Combined thermo-mechanical degradation: high friction bearing distress")

        # 3. Current check
        if current_a > self.config.CURRENT_MAX_A:
            violations.append({
                "feature_name": "current_a",
                "observed_value": round(current_a, 2),
                "configured_limit": self.config.CURRENT_MAX_A,
                "violation_type": "upper_bound",
                "severity": "warning",
                "message": f"Current overdraw ({current_a:.2f}A > {self.config.CURRENT_MAX_A}A)"
            })
            score += 15.0
            possible_causes.append("Mechanical binding, motor overload, or phase voltage imbalance")
        elif current_a < self.config.CURRENT_MIN_A:
            violations.append({
                "feature_name": "current_a",
                "observed_value": round(current_a, 2),
                "configured_limit": self.config.CURRENT_MIN_A,
                "violation_type": "lower_bound",
                "severity": "warning",
                "message": f"Current underdraw ({current_a:.2f}A < {self.config.CURRENT_MIN_A}A)"
            })
            score += 15.0
            possible_causes.append("Underloaded condition, decoupled drive belt, or open phase fault")

        # 4. RPM check
        if rpm > max_rpm:
            violations.append({
                "feature_name": "rpm",
                "observed_value": round(rpm, 1),
                "configured_limit": round(max_rpm, 1),
                "violation_type": "upper_bound",
                "severity": "warning",
                "message": f"Motor overspeed ({rpm:.0f} RPM > {max_rpm:.0f} RPM)"
            })
            score += 10.0
            possible_causes.append("VFD speed regulation instability or load loss")
        elif rpm < min_rpm:
            violations.append({
                "feature_name": "rpm",
                "observed_value": round(rpm, 1),
                "configured_limit": round(min_rpm, 1),
                "violation_type": "lower_bound",
                "severity": "warning",
                "message": f"Motor underspeed / drag ({rpm:.0f} RPM < {min_rpm:.0f} RPM)"
            })
            score += 10.0
            possible_causes.append("Excessive mechanical drag, stalling torque, or slip degradation")

        # Deduplicate causes preserving order
        seen = set()
        deduped = []
        for c in possible_causes:
            if c not in seen:
                seen.add(c)
                deduped.append(c)

        return min(score, 100.0), violations, deduped

rule_engine = RuleEngine()
