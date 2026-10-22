export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type MachineCriticality = 'LOW' | 'MEDIUM' | 'HIGH';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';
export type TaskStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type SimulationScenario = 'normal' | 'overheating' | 'excessive_vibration' | 'combined_fault' | 'recovery';

export interface MachineSummary {
  id: number;
  machine_code: string;
  name: string;
  machine_type: string;
  location: string;
  criticality: MachineCriticality;
  status: string;
  created_at: string;
  latest_temperature: number | null;
  latest_vibration: number | null;
  latest_current: number | null;
  latest_rpm: number | null;
  latest_reading_time: string | null;
  risk_score: number;
  risk_level: RiskLevel;
  active_alert_count: number;
  is_stale?: boolean;
}

export interface ReadingItem {
  id: number;
  timestamp: string;
  temperature_c: number;
  vibration_mm_s_rms: number;
  current_a: number;
  rpm: number;
  quality_status: string;
}

export interface RuleViolation {
  feature_name: string;
  observed_value: number;
  configured_limit: number;
  violation_type: string;
  severity: string;
  message?: string;
}

export interface EvidenceItem {
  type: string;
  feature?: string;
  observed?: number;
  limit?: number;
  severity?: string;
  description?: string;
  score?: number;
  model_version?: string;
}

export interface HealthAssessment {
  machine_code: string;
  machine_name: string;
  risk_score: number;
  risk_level: RiskLevel;
  rule_score: number;
  ml_anomaly: boolean;
  ml_score: number | null;
  model_version: string;
  evidence: EvidenceItem[];
  possible_causes: string[];
  new_alert_created?: boolean;
  active_alert_id?: number | null;
  task_created?: boolean;
  generated_task_id?: number | null;
  reading_id: number;
  timestamp: string;
}

export interface AlertItem {
  id: number;
  machine_id: number;
  machine_code: string;
  machine_name: string;
  prediction_id: number | null;
  alert_type: string;
  severity: RiskLevel;
  description: string;
  status: AlertStatus;
  deduplication_key: string;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  task_id: number | null;
}

export interface MaintenanceTaskItem {
  id: number;
  machine_id: number;
  machine_code: string;
  machine_name: string;
  alert_id: number;
  title: string;
  description: string;
  priority: RiskLevel;
  recommendation: string;
  status: TaskStatus;
  notes: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface MachineDetail {
  id: number;
  machine_code: string;
  name: string;
  machine_type: string;
  location: string;
  criticality: MachineCriticality;
  status: string;
  created_at: string;
  current_health: HealthAssessment;
  recent_readings: ReadingItem[];
  recent_alerts: AlertItem[];
  related_tasks: MaintenanceTaskItem[];
}

export interface DashboardSummary {
  total_machines: number;
  healthy_machines: number;
  warning_machines: number;
  critical_machines: number;
  active_alerts: number;
  open_maintenance_tasks: number;
  health_distribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  machines: MachineSummary[];
  recent_alerts: AlertItem[];
  recent_tasks: MaintenanceTaskItem[];
  recent_activity: {
    id: string;
    type: 'ALERT' | 'TASK';
    title: string;
    machine: string;
    description: string;
    status: string;
    timestamp: string;
  }[];
}

export interface SystemSettings {
  temp_warning_c: number;
  temp_critical_c: number;
  vibration_warning_rms: number;
  vibration_critical_rms: number;
  current_min_a: number;
  current_max_a: number;
  rpm_min: number;
  rpm_max: number;
  simulation_interval_sec: number;
  risk_low_max: number;
  risk_medium_max: number;
  risk_high_max: number;
}
