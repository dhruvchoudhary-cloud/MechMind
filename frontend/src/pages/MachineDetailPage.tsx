import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Cpu,
  ArrowLeft,
  Thermometer,
  Activity,
  Zap,
  RotateCw,
  AlertTriangle,
  Wrench,
  CheckCircle2,
  AlertOctagon,
  Brain,
  FileText
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';

import { api } from '../services/api';
import { MachineDetail, SystemSettings } from '../types';
import { StatusBadge } from '../components/StatusBadge';

export const MachineDetailPage: React.FC = () => {
  const { machineId } = useParams<{ machineId: string }>();
  const [data, setData] = useState<MachineDetail | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingAlertId, setUpdatingAlertId] = useState<number | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<number | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [settings, setSettings] = useState<SystemSettings>({
    temp_warning_c: 70.0,
    temp_critical_c: 85.0,
    vibration_warning_rms: 4.0,
    vibration_critical_rms: 6.5,
    current_min_a: 2.0,
    current_max_a: 15.0,
    rpm_min: 1000.0,
    rpm_max: 1800.0,
    simulation_interval_sec: 2.5,
    risk_low_max: 24,
    risk_medium_max: 49,
    risk_high_max: 74,
  });

  const loadData = async () => {
    if (!machineId) return;
    try {
      const detail = await api.fetchMachineDetail(machineId);
      setData(detail);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load machine diagnostics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    api.fetchSettings().then(setSettings).catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [machineId]);

  const handleAlertStatus = async (alertId: number, newStatus: 'acknowledged' | 'resolved') => {
    try {
      setUpdatingAlertId(alertId);
      await api.updateAlertStatus(alertId, newStatus);
      setActionNotice(`Alert #${alertId} updated to '${newStatus}'.`);
      setTimeout(() => setActionNotice(null), 4000);
      await loadData();
    } catch (err: any) {
      alert(`Failed to update alert: ${err.message}`);
    } finally {
      setUpdatingAlertId(null);
    }
  };

  const handleTaskStatus = async (taskId: number, newStatus: 'in_progress' | 'completed') => {
    try {
      setUpdatingTaskId(taskId);
      await api.updateTask(taskId, { status: newStatus });
      setActionNotice(`Task #${taskId} transitioned to '${newStatus}'.`);
      setTimeout(() => setActionNotice(null), 4000);
      await loadData();
    } catch (err: any) {
      alert(`Failed to update task: ${err.message}`);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-8 h-8 border-2 border-[#FFD629] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono uppercase tracking-widest text-[#A3A3A3]">
          LOADING DIAGNOSTIC DOSSIER FOR {machineId}...
        </span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 bg-[#111111] border border-[#FF554A] max-w-xl mx-auto my-12 text-center font-mono">
        <AlertOctagon className="w-12 h-12 text-[#FF554A] mx-auto mb-3" />
        <h3 className="text-base font-bold text-white mb-2 uppercase">Asset Not Found or Unreachable</h3>
        <p className="text-xs text-[#A3A3A3] mb-4">{error || `Machine '${machineId}' could not be located.`}</p>
        <Link
          to="/machines"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#FFD629] text-black text-xs font-bold uppercase tracking-wider"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Return to Machine Explorer
        </Link>
      </div>
    );
  }

  const {
    id,
    machine_code,
    name,
    machine_type,
    location,
    criticality,
    status: assetStatus,
    created_at,
    current_health,
    recent_readings,
    recent_alerts,
    related_tasks
  } = data;

  const latest_reading = recent_readings && recent_readings.length > 0 ? recent_readings[0] : null;
  const active_alerts = recent_alerts || [];
  const open_tasks = related_tasks || [];
  const ml_anomaly = current_health?.ml_anomaly ?? false;
  const risk_score = current_health?.risk_score ?? 0;
  const risk_level = current_health?.risk_level ?? 'low';
  const rule_violations = current_health?.evidence?.filter((e: any) => e.type === 'RULE_VIOLATION') || [];

  const chartData = (recent_readings || []).map((r) => ({
    time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    temp: r.temperature_c,
    vib: r.vibration_mm_s_rms,
    current: r.current_a,
    rpm: r.rpm
  }));

  const effectiveTempWarn = settings.temp_warning_c;
  const effectiveTempCrit = settings.temp_critical_c;
  const effectiveVibWarn = settings.vibration_warning_rms;
  const effectiveVibCrit = settings.vibration_critical_rms;

  return (
    <div className="space-y-8 animate-fade-in font-mono">
      {/* Navigation Breadcrumb */}
      <div className="flex items-center justify-between pb-3 border-b border-[#303030]">
        <Link
          to="/machines"
          className="inline-flex items-center gap-2 text-xs text-[#A3A3A3] hover:text-[#FFD629] transition-colors uppercase tracking-wider"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Machine Explorer
        </Link>
        <span className="text-[10px] text-[#6E6E6E] uppercase">
          ASSET IDENTIFIER: {machine_code}
        </span>
      </div>

      {actionNotice && (
        <div className="p-3 bg-[#171717] border border-[#FFD629] text-[#FFD629] text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Asset Hero Dossier Header */}
      <div className="relative bg-[#0B0B0B] border border-[#303030] overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src="/assets/turbine_detail.jpg"
            alt="Machine Turbine Header"
            className="w-full h-full object-cover object-center opacity-25"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/85 to-transparent" />
        </div>

        <div className="relative z-10 p-6 sm:p-10">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div>
              <div className="flex items-center gap-2.5 text-xs text-[#FFD629] mb-1">
                <span className="natgeo-mark-sm" />
                <span className="font-bold tracking-widest">{machine_code}</span>
                <span className="text-[#6E6E6E]">/</span>
                <span className="text-[#A3A3A3]">{location}</span>
              </div>

              <h1 className="text-3xl sm:text-4xl font-black text-[#F4F4F4] tracking-tight uppercase font-sans">
                {name}
              </h1>

              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-[#A3A3A3]">
                <span>TYPE: <b className="text-[#F4F4F4]">{machine_type}</b></span>
                <span>•</span>
                <span>CRITICALITY: <b className="text-[#F4F4F4]">{criticality}</b></span>
                <span>•</span>
                <span>LAST TELEMETRY: <b className="text-[#F4F4F4]">{latest_reading ? new Date(latest_reading.timestamp).toLocaleTimeString() : '--:--:--'}</b></span>
              </div>
            </div>

            <div className="flex flex-col sm:items-end gap-2">
              <StatusBadge status={risk_level} size="lg" />
            </div>
          </div>

          {/* Primary Telemetry Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-[#303030]/80">
            <div className="p-4 bg-[#111111]/90 border border-[#303030]">
              <div className="text-[10px] text-[#6E6E6E] uppercase">BEARING TEMPERATURE</div>
              <div className={`text-3xl font-bold mt-1 ${latest_reading && latest_reading.temperature_c > effectiveTempWarn ? 'text-[#FF554A]' : 'text-[#F4F4F4]'}`}>
                {latest_reading ? `${latest_reading.temperature_c.toFixed(1)}°C` : '--'}
              </div>
              <div className="text-[10px] text-[#A3A3A3] mt-1">Threshold: {effectiveTempWarn} / {effectiveTempCrit}°C</div>
            </div>

            <div className="p-4 bg-[#111111]/90 border border-[#303030]">
              <div className="text-[10px] text-[#6E6E6E] uppercase">VIBRATION RMS VELOCITY</div>
              <div className={`text-3xl font-bold mt-1 ${latest_reading && latest_reading.vibration_mm_s_rms > effectiveVibWarn ? 'text-[#FFD629]' : 'text-[#F4F4F4]'}`}>
                {latest_reading ? `${latest_reading.vibration_mm_s_rms.toFixed(2)}` : '--'}
              </div>
              <div className="text-[10px] text-[#A3A3A3] mt-1">ISO Warn: {effectiveVibWarn} mm/s</div>
            </div>

            <div className="p-4 bg-[#111111]/90 border border-[#303030]">
              <div className="text-[10px] text-[#6E6E6E] uppercase">STATOR CURRENT</div>
              <div className="text-3xl font-bold text-[#F4F4F4] mt-1">
                {latest_reading ? `${latest_reading.current_a.toFixed(1)} A` : '--'}
              </div>
              <div className="text-[10px] text-[#A3A3A3] mt-1">Range: {settings.current_min_a} - {settings.current_max_a} A</div>
            </div>

            <div className="p-4 bg-[#111111]/90 border border-[#303030]">
              <div className="text-[10px] text-[#6E6E6E] uppercase">ROTATIONAL SPEED</div>
              <div className="text-3xl font-bold text-[#F4F4F4] mt-1">
                {latest_reading ? `${Math.round(latest_reading.rpm)}` : '--'}
              </div>
              <div className="text-[10px] text-[#A3A3A3] mt-1">Rated: {settings.rpm_min} - {settings.rpm_max} RPM</div>
            </div>
          </div>
        </div>
      </div>

      {/* 8. “Inside the Machine” AI Intelligence / Diagnostics Panel */}
      <div className="p-6 bg-[#111111] border border-[#303030] relative">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#FFD629]" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#303030]">
          <div className="flex items-center gap-2.5">
            <span className="natgeo-mark-sm" />
            <div>
              <h2 className="text-base font-bold tracking-wider text-[#F4F4F4] uppercase">
                INSIDE THE MACHINE — DIAGNOSTIC SYNTHESIS
              </h2>
              <span className="text-[10px] text-[#A3A3A3] uppercase">
                HYBRID ISOLATION FOREST + PHYSICAL RULE EVALUATION
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#6E6E6E]">ML STATUS:</span>
            <span className={`font-semibold ${ml_anomaly ? 'text-[#FFD629]' : 'text-[#72C99A]'}`}>
              {ml_anomaly ? 'MULTIVARIATE ANOMALY DETECTED' : 'INLIER / NOMINAL PATTERN'}
            </span>
          </div>
        </div>

        {/* Risk Dial Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-6 p-5 bg-[#171717] border border-[#303030]">
          <div className="flex flex-col justify-center">
            <span className="text-[10px] text-[#6E6E6E] uppercase tracking-wider">
              ASSET RISK SCORE
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className={`text-5xl font-bold ${
                risk_score >= 50 ? 'text-[#FF554A]' : risk_score >= 25 ? 'text-[#F5B942]' : 'text-[#72C99A]'
              }`}>
                {risk_score.toFixed(0)}
              </span>
              <span className="text-sm text-[#6E6E6E]">/ 100</span>
            </div>
            <span className="text-xs text-[#A3A3A3] mt-1 uppercase font-semibold">
              SEVERITY: {risk_level.toUpperCase()} RISK
            </span>
          </div>

          <div className="md:col-span-2 flex flex-col justify-center">
            <div className="flex justify-between text-xs mb-2">
              <span className="text-[#A3A3A3]">Dynamic Degradation Bar</span>
              <span className="text-[#FFD629] font-bold">{risk_score.toFixed(1)}%</span>
            </div>
            <div className="h-3 w-full bg-[#0B0B0B] border border-[#303030] overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  risk_score >= 75
                    ? 'bg-[#FF554A]'
                    : risk_score >= 50
                    ? 'bg-[#FF554A]'
                    : risk_score >= 25
                    ? 'bg-[#F5B942]'
                    : 'bg-[#72C99A]'
                }`}
                style={{ width: `${Math.max(risk_score, 4)}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-[#6E6E6E] mt-1.5">
              <span>0 (NOMINAL)</span>
              <span>25 (LOW WARN)</span>
              <span>50 (ELEVATED)</span>
              <span>75 (CRITICAL)</span>
            </div>
          </div>
        </div>

        {/* 3-Tier Diagnostic Hierarchy */}
        <div className="space-y-4">
          <div className="p-4 bg-[#0B0B0B] border border-[#303030]">
            <div className="text-[10px] text-[#FFD629] font-bold uppercase tracking-wider mb-1.5">
              01 / DETECTED SIGNAL
            </div>
            <div className="text-xs text-[#F4F4F4] leading-relaxed">
              {rule_violations && rule_violations.length > 0 ? (
                <span>Physical rule breaches: {rule_violations.map((r: any) => `${r.feature_name} = ${r.observed_value}`).join(', ')}.</span>
              ) : ml_anomaly ? (
                <span>Unsupervised Isolation Forest anomaly flagged: multi-dimensional correlation drift outside baseline operating envelope.</span>
              ) : (
                <span>Telemetry parameters within standard baseline operating tolerances. Vibration velocity and thermal dynamics nominal.</span>
              )}
            </div>
          </div>

          <div className="p-4 bg-[#0B0B0B] border border-[#303030]">
            <div className="text-[10px] text-[#F5B942] font-bold uppercase tracking-wider mb-1.5">
              02 / POSSIBLE INTERPRETATION
            </div>
            <div className="text-xs text-[#A3A3A3] leading-relaxed">
              {latest_reading && latest_reading.temperature_c > effectiveTempWarn && latest_reading.vibration_mm_s_rms > effectiveVibWarn ? (
                <span>Severe mechanical degradation: Impending bearing seizure, catastrophic rotor unbalance, or structural looseness.</span>
              ) : latest_reading && latest_reading.temperature_c > effectiveTempWarn ? (
                <span>Thermal overload: Bearing friction, blocked cooling ventilation, or electrical stator winding resistance.</span>
              ) : latest_reading && latest_reading.vibration_mm_s_rms > effectiveVibWarn ? (
                <span>Dynamic vibration velocity exceeding ISO Class II/III limits: Mechanical unbalance, shaft angular misalignment, or bearing race defect.</span>
              ) : (
                <span>Drivetrain balance optimal. Continuous electromagnetic torque delivery without detectable mechanical resistance.</span>
              )}
            </div>
          </div>

          <div className="p-4 bg-[#0B0B0B] border border-[#303030]">
            <div className="text-[10px] text-[#72C99A] font-bold uppercase tracking-wider mb-1.5">
              03 / RECOMMENDED ACTION
            </div>
            <div className="text-xs text-[#F4F4F4] leading-relaxed font-sans">
              {latest_reading && (latest_reading.temperature_c > effectiveTempWarn || latest_reading.vibration_mm_s_rms > effectiveVibWarn) ? (
                <span>Dispatch field technician for urgent inspection: Perform vibration FFT spectrum, inspect lubricant grease viscosity, verify coupling element, and tighten foundation bolts.</span>
              ) : (
                <span>Continue autonomous telemetry surveillance at standard 2.5s sample frequency. No physical inspection required.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 7. High-Resolution Time-Series Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Temperature vs Vibration */}
        <div className="p-6 bg-[#111111] border border-[#303030]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#303030]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#FF554A]" />
              <h3 className="text-xs font-bold tracking-widest text-[#F4F4F4] uppercase">
                TEMPERATURE (°C) VS VIBRATION (RMS)
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-[#FF554A]">Temp</span>
              <span className="text-[#FFD629]">Vib</span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#303030" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" stroke="#6E6E6E" fontSize={10} tickLine={false} />
                <YAxis stroke="#6E6E6E" fontSize={11} domain={['auto', 'auto']} tickLine={false} />
                <Tooltip />
                <ReferenceLine y={effectiveTempWarn} stroke="#F5B942" strokeDasharray="4 4" />
                <ReferenceLine y={effectiveTempCrit} stroke="#FF554A" strokeDasharray="4 4" />
                <Line type="monotone" dataKey="temp" stroke="#FF554A" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="vib" stroke="#FFD629" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Current vs RPM */}
        <div className="p-6 bg-[#111111] border border-[#303030]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#303030]">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#72C99A]" />
              <h3 className="text-xs font-bold tracking-widest text-[#F4F4F4] uppercase">
                CURRENT (A) & ROTATIONAL VELOCITY (RPM)
              </h3>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-[#72C99A]">Current</span>
              <span className="text-[#A3A3A3]">RPM</span>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#303030" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" stroke="#6E6E6E" fontSize={10} tickLine={false} />
                <YAxis stroke="#6E6E6E" fontSize={11} domain={['auto', 'auto']} tickLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="current" stroke="#72C99A" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 9 & 10. Active Alerts & Maintenance Tasks for this Machine */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Alerts */}
        <div className="p-6 bg-[#111111] border border-[#303030]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#303030]">
            <div className="flex items-center gap-2">
              <span className="natgeo-mark-sm" />
              <h3 className="text-xs font-bold tracking-widest text-[#F4F4F4] uppercase">
                INCIDENT ALERTS ({active_alerts?.length ?? 0})
              </h3>
            </div>
          </div>

          <div className="space-y-3">
            {active_alerts && active_alerts.length > 0 ? (
              active_alerts.map((alert: any) => (
                <div key={alert.id} className="p-4 bg-[#171717] border border-[#303030]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={alert.severity} size="sm" />
                        <span className="text-xs font-bold text-[#F4F4F4]">{alert.alert_type}</span>
                      </div>
                      <p className="text-xs text-[#A3A3A3] mt-1.5 font-sans leading-relaxed">{alert.description}</p>
                      <div className="text-[10px] text-[#6E6E6E] mt-2">
                        LAST SEEN: {new Date(alert.last_seen_at).toLocaleTimeString()}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {alert.status === 'active' && (
                        <button
                          disabled={updatingAlertId === alert.id}
                          onClick={() => handleAlertStatus(alert.id, 'acknowledged')}
                          className="px-2.5 py-1 bg-[#111111] hover:bg-[#202020] text-[#F5B942] border border-[#F5B942]/60 text-[11px] uppercase font-bold"
                        >
                          Acknowledge
                        </button>
                      )}
                      {alert.status !== 'resolved' && (
                        <button
                          disabled={updatingAlertId === alert.id}
                          onClick={() => handleAlertStatus(alert.id, 'resolved')}
                          className="px-2.5 py-1 bg-[#111111] hover:bg-[#202020] text-[#72C99A] border border-[#72C99A]/60 text-[11px] uppercase font-bold"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-[#6E6E6E]">
                No active incident alerts registered for this asset.
              </div>
            )}
          </div>
        </div>

        {/* Maintenance Tasks */}
        <div className="p-6 bg-[#111111] border border-[#303030]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#303030]">
            <div className="flex items-center gap-2">
              <span className="natgeo-mark-sm" />
              <h3 className="text-xs font-bold tracking-widest text-[#F4F4F4] uppercase">
                AUTONOMOUS MAINTENANCE WORK ORDERS ({open_tasks?.length ?? 0})
              </h3>
            </div>
          </div>

          <div className="space-y-3">
            {open_tasks && open_tasks.length > 0 ? (
              open_tasks.map((task: any) => (
                <div key={task.id} className="p-4 bg-[#171717] border border-[#303030]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={task.priority} size="sm" />
                        <span className="text-xs font-bold text-[#F4F4F4]">{task.title}</span>
                      </div>
                      <p className="text-xs text-[#A3A3A3] mt-1.5 font-sans leading-relaxed">{task.recommendation}</p>
                      <div className="text-[10px] text-[#6E6E6E] mt-2">
                        DISPATCHED: {new Date(task.created_at).toLocaleTimeString()}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 flex-shrink-0">
                      {task.status === 'open' && (
                        <button
                          disabled={updatingTaskId === task.id}
                          onClick={() => handleTaskStatus(task.id, 'in_progress')}
                          className="px-2.5 py-1 bg-[#FFD629] hover:bg-yellow-400 text-black text-[11px] uppercase font-bold"
                        >
                          Start Task
                        </button>
                      )}
                      {task.status === 'in_progress' && (
                        <button
                          disabled={updatingTaskId === task.id}
                          onClick={() => handleTaskStatus(task.id, 'completed')}
                          className="px-2.5 py-1 bg-[#72C99A] hover:bg-emerald-400 text-black text-[11px] uppercase font-bold"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-xs text-[#6E6E6E]">
                No pending maintenance tasks dispatched for this machine.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
