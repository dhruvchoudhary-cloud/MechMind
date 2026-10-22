from typing import List, Dict, Any, Tuple
from app.config import settings

class RiskEngine:
    def __init__(self, config=None):
        self.config = config or settings

    def calculate_risk(
        self,
        rule_score: float,
        rule_violations: List[Dict[str, Any]],
        ml_anomaly: bool,
        ml_score: float,
        model_version: str,
        possible_causes: List[str]
    ) -> Tuple[float, str, List[Dict[str, Any]]]:
        """
        Combines rule violations and ML anomaly score into a deterministic 0-100 risk score.
        Returns:
            (risk_score, risk_level, evidence_items)
        """
        evidence: List[Dict[str, Any]] = []
        score = 0.0

        # Add rule score from violations
        score += rule_score
        for v in rule_violations:
            evidence.append({
                "type": "RULE_VIOLATION",
                "feature": v.get("feature_name"),
                "observed": v.get("observed_value"),
                "limit": v.get("configured_limit"),
                "severity": v.get("severity"),
                "description": v.get("message")
            })

        # Add ML anomaly contribution
        if ml_anomaly:
            score += 25.0
            evidence.append({
                "type": "ML_ANOMALY",
                "feature": "multivariate_telemetry",
                "score": ml_score,
                "model_version": model_version,
                "severity": "warning",
                "description": f"Isolation Forest flagged multivariate reading as abnormal (decision score: {ml_score})"
            })
        elif model_version in ["unavailable", "error_fallback", "invalid_input"]:
            evidence.append({
                "type": "ML_UNAVAILABLE",
                "feature": "multivariate_telemetry",
                "score": None,
                "model_version": model_version,
                "description": f"ML anomaly detector unavailable ({model_version}); operating on deterministic rule baseline"
            })
        else:
            evidence.append({
                "type": "ML_NORMAL",
                "feature": "multivariate_telemetry",
                "score": ml_score,
                "model_version": model_version,
                "description": "Isolation Forest indicates reading is within normal distribution baseline"
            })

        # Cap score at 100
        final_score = min(max(round(score, 1), 0.0), 100.0)

        # Categorize
        if final_score <= self.config.RISK_LOW_MAX:
            risk_level = "low"
        elif final_score <= self.config.RISK_MEDIUM_MAX:
            risk_level = "medium"
        elif final_score <= self.config.RISK_HIGH_MAX:
            risk_level = "high"
        else:
            risk_level = "critical"

        return final_score, risk_level, evidence

risk_engine = RiskEngine()
