import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Cpu,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Wrench,
  Activity,
  ArrowRight,
  TrendingUp,
  Clock,
  Thermometer,
  Zap,
  Info
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
  ReferenceLine
} from 'recharts';

import { api } from '../services/api';
import { DashboardSummary, ReadingItem } from '../types';
import { StatusBadge } from '../components/StatusBadge';
import { SimulatorControls } from '../components/SimulatorControls';

export const OverviewDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [selectedMachineCode, setSelectedMachineCode] = useState<string>('motor-001');
  const [fleetReadings, setFleetReadings] = useState<ReadingItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const isFetchingRef = useRef<boolean>(false);

  const loadDashboard = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      const summary = await api.fetchDashboardSummary();
      setData(summary);
      setError(null);

      const targetCode = selectedMachineCode || (summary.machines[0]?.machine_code ?? 'motor-001');
      const readings = await api.fetchMachineReadings(targetCode, 25);
      setFleetReadings(readings);
    } catch (err: any) {
      setError(err.message || 'Failed to connect to backend service.');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(loadDashboard, 3000);
    return () => clearInterval(interval);
  }, [selectedMachineCode]);

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-8 h-8 border-2 border-[#FFD629] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono uppercase tracking-widest text-[#A3A3A3]">
          CONNECTING TO INDUSTRIAL TELEMETRY STREAM...
        </span>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-8 bg-[#111111] border border-[#FF554A] max-w-xl mx-auto my-12 text-center">
        <AlertOctagon className="w-12 h-12 text-[#FF554A] mx-auto mb-3" />
        <h3 className="text-lg font-bold text-white mb-2 font-mono uppercase">Backend Connection Error</h3>
        <p className="text-sm text-[#A3A3A3] mb-4">{error}</p>
        <button
          onClick={loadDashboard}
          className="px-4 py-2 bg-[#FFD629] text-black font-mono font-bold text-xs uppercase tracking-wider transition-colors hover:bg-yellow-400"
        >
          Retry Connection
        </button>
      </div>
    );
  }

  const distributionData = data
    ? [
        { name: 'Low Risk', count: data.health_distribution.low, color: '#72C99A' },
        { name: 'Medium Risk', count: data.health_distribution.medium, color: '#F5B942' },
        { name: 'High Risk', count: data.health_distribution.high, color: '#FF554A' },
        { name: 'Critical', count: data.health_distribution.critical, color: '#FF554A' },
      ]
    : [];

  const trendData = fleetReadings.map((r) => ({
    time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    temp: r.temperature_c,
    vib: r.vibration_mm_s_rms,
    current: r.current_a,
  }));

  const selectedMachineObj = data?.machines.find((m) => m.machine_code === selectedMachineCode);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* 4. HERO / OVERVIEW SECTION — Cinematic Editorial Layout */}
      <section className="relative bg-[#0B0B0B] border border-[#303030] overflow-hidden">
        {/* Cinematic Imagery Background with Gradient Overlay */}
        <div className="absolute inset-0 z-0">
          <img
            src="/assets/hero_motor.jpg"
            alt="Industrial Machinery"
            className="w-full h-full object-cover object-center opacity-30 md:opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/90 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0B] via-transparent to-transparent" />
        </div>

        {/* Hero Content Panel */}
        <div className="relative z-10 p-6 sm:p-10 lg:p-12 max-w-4xl">
          {/* Metadata Badges */}
          <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono tracking-widest uppercase mb-4 text-[#A3A3A3]">
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-[#111111]/90 border border-[#303030] text-[#FFD629] font-bold">
              <span className="natgeo-mark-sm" />
              AUTONOMOUS MAINTENANCE INTELLIGENCE
            </span>
            <span className="px-2.5 py-1 bg-[#111111]/90 border border-[#303030] text-[#F4F4F4]">
              TELEMETRY MONITORING: 2.5s INTERVAL
            </span>
            <span className="px-2.5 py-1 bg-[#111111]/90 border border-[#303030] text-[#72C99A]">
              SYSTEM STATUS: NOMINAL
            </span>
          </div>

          {/* Oversized Editorial Headline */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-[#F4F4F4] leading-[1.08] uppercase">
            Machines tell a story.
            <br />
            We detect the <span className="text-[#FFD629]">warning</span>.
          </h1>

          {/* Narrative Subtitle */}
          <p className="mt-4 text-sm sm:text-base text-[#A3A3A3] max-w-2xl leading-relaxed">
            Continuous mechanical surveillance of high-voltage industrial motor drivetrains. Synthesizing physical thermal-vibration thresholds with unsupervised multivariate anomaly detection to dispatch autonomous maintenance actions prior to operational failure.
          </p>

          {/* Quick Stat Anchors */}
          <div className="mt-8 pt-6 border-t border-[#303030]/80 grid grid-cols-2 sm:grid-cols-4 gap-6 font-mono">
            <div>
              <div className="text-[10px] text-[#6E6E6E] uppercase tracking-wider">ACTIVE ASSETS</div>
              <div className="text-xl sm:text-2xl font-bold text-[#F4F4F4] mt-0.5">
                0{data?.total_machines ?? 0} <span className="text-xs font-normal text-[#6E6E6E]">UNITS</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#6E6E6E] uppercase tracking-wider">HEALTH SCORE</div>
              <div className="text-xl sm:text-2xl font-bold text-[#72C99A] mt-0.5">
                {data?.healthy_machines === data?.total_machines ? '100%' : 'ATTENTION'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#6E6E6E] uppercase tracking-wider">DETECTION ENGINE</div>
              <div className="text-xl sm:text-2xl font-bold text-[#FFD629] mt-0.5">
                DUAL <span className="text-xs font-normal text-[#6E6E6E]">HYBRID</span>
              </div>
            </div>
            <div>
              <div className="text-[10px] text-[#6E6E6E] uppercase tracking-wider">UNRESOLVED INCIDENTS</div>
              <div className={`text-xl sm:text-2xl font-bold mt-0.5 ${data && data.active_alerts > 0 ? 'text-[#FF554A]' : 'text-[#F4F4F4]'}`}>
                {data?.active_alerts ?? 0} <span className="text-xs font-normal text-[#6E6E6E]">ACTIVE</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 11. SIMULATION CONTROL CENTER — “Test the Unexpected” */}
      <SimulatorControls onUpdate={loadDashboard} />

      {/* 5. FLEET HEALTH SECTION — Wide Editorial Metric Strip */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="natgeo-mark-sm" />
            <h2 className="text-xs font-mono tracking-widest text-[#A3A3A3] uppercase font-bold">
              FLEET OPERATIONAL METRICS
            </h2>
          </div>
          <span className="text-[11px] font-mono text-[#6E6E6E]">REAL-TIME REPOSITORY TELEMETRY</span>
        </div>

        {/* Wide Asymmetric Grid with Thin Borders */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 border border-[#303030] bg-[#111111] divide-y lg:divide-y-0 lg:divide-x divide-[#303030]">
          {/* Total Machines */}
          <div className="p-5 flex flex-col justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#6E6E6E]">
              TOTAL MONITORED
            </span>
            <div className="my-2">
              <span className="text-3xl sm:text-4xl font-mono font-bold text-[#F4F4F4]">
                {data?.total_machines ?? 0}
              </span>
              <span className="text-xs font-mono text-[#6E6E6E] ml-2">UNITS</span>
            </div>
            <span className="text-[11px] text-[#A3A3A3]">Active Assets</span>
          </div>

          {/* Healthy Machines */}
          <div className="p-5 flex flex-col justify-between bg-[#171717]">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#72C99A]">
              NOMINAL HEALTH
            </span>
            <div className="my-2">
              <span className="text-3xl sm:text-4xl font-mono font-bold text-[#72C99A]">
                {data?.healthy_machines ?? 0}
              </span>
              <span className="text-xs font-mono text-[#6E6E6E] ml-2">OPTIMAL</span>
            </div>
            <span className="text-[11px] text-[#A3A3A3]">In-Tolerance Profile</span>
          </div>

          {/* Warning State */}
          <div className="p-5 flex flex-col justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#F5B942]">
              MODERATE DRIFT
            </span>
            <div className="my-2">
              <span className="text-3xl sm:text-4xl font-mono font-bold text-[#F5B942]">
                {data?.warning_machines ?? 0}
              </span>
              <span className="text-xs font-mono text-[#6E6E6E] ml-2">WARNED</span>
            </div>
            <span className="text-[11px] text-[#A3A3A3]">Watchlist Status</span>
          </div>

          {/* Critical Machines */}
          <div className="p-5 flex flex-col justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF554A]">
              IMMINENT FAULT
            </span>
            <div className="my-2">
              <span className="text-3xl sm:text-4xl font-mono font-bold text-[#FF554A]">
                {data?.critical_machines ?? 0}
              </span>
              <span className="text-xs font-mono text-[#6E6E6E] ml-2">CRITICAL</span>
            </div>
            <span className="text-[11px] text-[#A3A3A3]">Immediate Intervention</span>
          </div>

          {/* Active Alerts */}
          <div className="p-5 flex flex-col justify-between">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#A3A3A3]">
              ACTIVE ALERTS
            </span>
            <div className="my-2">
              <span className={`text-3xl sm:text-4xl font-mono font-bold ${data && data.active_alerts > 0 ? 'text-[#FF554A]' : 'text-[#F4F4F4]'}`}>
                {data?.active_alerts ?? 0}
              </span>
              <span className="text-xs font-mono text-[#6E6E6E] ml-2">EVENTS</span>
            </div>
            <span className="text-[11px] text-[#A3A3A3]">Unresolved Incidents</span>
          </div>

          {/* Open Maintenance Tasks */}
          <div className="p-5 flex flex-col justify-between bg-[#171717]">
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#FFD629]">
              WORK ORDERS
            </span>
            <div className="my-2">
              <span className="text-3xl sm:text-4xl font-mono font-bold text-[#FFD629]">
                {data?.open_maintenance_tasks ?? 0}
              </span>
              <span className="text-xs font-mono text-[#6E6E6E] ml-2">OPEN</span>
            </div>
            <span className="text-[11px] text-[#A3A3A3]">Autonomous Queue</span>
          </div>
        </div>
      </section>

      {/* 7. SENSOR ANALYTICS & RISK CHARTS */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Telemetry Stream Chart with Machine Selector */}
        <div className="lg:col-span-2 p-6 bg-[#111111] border border-[#303030]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-[#303030]">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#FFD629]" />
                <h3 className="text-sm font-bold tracking-wider text-[#F4F4F4] uppercase font-mono">
                  TELEMETRY TIME-SERIES STREAM
                </h3>
                {selectedMachineObj?.is_stale && (
                  <span className="text-[10px] bg-[#F5B942]/10 text-[#F5B942] border border-[#F5B942] px-2 py-0.5 font-mono">
                    STALE TELEMETRY
                  </span>
                )}
              </div>
              <p className="text-xs text-[#A3A3A3] mt-1 font-mono">
                SELECTED TARGET: <span className="text-[#FFD629] font-bold">{selectedMachineObj?.name || selectedMachineCode}</span> ({selectedMachineCode})
              </p>
            </div>

            {/* Asset Selector Dropdown & Legend */}
            <div className="flex items-center gap-4">
              <select
                value={selectedMachineCode}
                onChange={(e) => setSelectedMachineCode(e.target.value)}
                className="bg-[#171717] border border-[#303030] text-xs text-[#F4F4F4] px-3 py-1.5 font-mono uppercase focus:outline-none focus:border-[#FFD629]"
              >
                {data?.machines.map((m) => (
                  <option key={m.machine_code} value={m.machine_code}>
                    {m.name} ({m.machine_code})
                  </option>
                ))}
              </select>

              <div className="hidden sm:flex items-center gap-4 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-[#FF554A]">
                  <span className="w-2.5 h-1 bg-[#FF554A]" /> TEMP (°C)
                </span>
                <span className="flex items-center gap-1.5 text-[#FFD629]">
                  <span className="w-2.5 h-1 bg-[#FFD629]" /> VIB (RMS)
                </span>
              </div>
            </div>
          </div>

          <div className="h-72 w-full">
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="#303030" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="time" stroke="#6E6E6E" fontSize={10} fontStyle="italic" tickLine={false} />
                  <YAxis stroke="#6E6E6E" fontSize={11} domain={['auto', 'auto']} tickLine={false} />
                  <Tooltip />
                  <ReferenceLine y={70} stroke="#F5B942" strokeDasharray="4 4" label={{ value: 'Warn: 70°C', fill: '#F5B942', fontSize: 10, position: 'right' }} />
                  <ReferenceLine y={85} stroke="#FF554A" strokeDasharray="4 4" label={{ value: 'Crit: 85°C', fill: '#FF554A', fontSize: 10, position: 'right' }} />
                  <Line type="monotone" dataKey="temp" stroke="#FF554A" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="vib" stroke="#FFD629" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#6E6E6E] font-mono uppercase">
                Awaiting telemetry samples...
              </div>
            )}
          </div>
        </div>

        {/* Fleet Risk Distribution */}
        <div className="p-6 bg-[#111111] border border-[#303030] flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 bg-[#72C99A]" />
              <h3 className="text-sm font-bold tracking-wider text-[#F4F4F4] uppercase font-mono">
                RISK TIER STRATIFICATION
              </h3>
            </div>
            <p className="text-xs text-[#A3A3A3] font-mono">Autonomous asset condition distribution</p>
          </div>

          <div className="h-56 w-full my-auto">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distributionData} margin={{ top: 20, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid stroke="#303030" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" stroke="#6E6E6E" fontSize={10} tickLine={false} />
                <YAxis stroke="#6E6E6E" fontSize={11} allowDecimals={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 0, 0, 0]}>
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-4 border-t border-[#303030] text-[11px] font-mono">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#72C99A]" />
              <span className="text-[#A3A3A3]">LOW (0-24)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#F5B942]" />
              <span className="text-[#A3A3A3]">MEDIUM (25-49)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#FF554A]" />
              <span className="text-[#A3A3A3]">HIGH (50-74)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-[#FF554A]" />
              <span className="text-[#A3A3A3]">CRITICAL (75-100)</span>
            </div>
          </div>
        </div>
      </section>

      {/* 6. MACHINE ASSET DOSSIER CARDS */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="natgeo-mark-sm" />
            <h2 className="text-xs font-mono tracking-widest text-[#A3A3A3] uppercase font-bold">
              MACHINE DOSSIER INDEX ({data?.machines.length ?? 0} ASSETS MONITORED)
            </h2>
          </div>
          <Link
            to="/machines"
            className="text-xs text-[#FFD629] hover:underline flex items-center gap-1 font-mono uppercase tracking-wider"
          >
            Machine Explorer <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {data?.machines.map((m) => (
            <Link
              key={m.id}
              to={`/machines/${m.machine_code}`}
              className="group p-5 bg-[#111111] border border-[#303030] hover:border-[#FFD629] transition-all duration-200 block relative"
            >
              {/* Top Accent Line on Hover */}
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-transparent group-hover:bg-[#FFD629] transition-colors" />

              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="font-bold text-[#FFD629]">{m.machine_code}</span>
                    <span className="text-[#6E6E6E]">/</span>
                    <span className="text-[#A3A3A3]">{m.location}</span>
                  </div>
                  <h3 className="font-bold text-white text-base mt-1 group-hover:text-[#FFD629] transition-colors">
                    {m.name}
                  </h3>
                  <div className="text-[11px] font-mono text-[#6E6E6E] uppercase mt-0.5">
                    {m.machine_type}
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={m.risk_level} size="sm" />
                  {m.is_stale && (
                    <span className="text-[9px] bg-[#F5B942]/10 text-[#F5B942] border border-[#F5B942] px-1.5 py-0.2 font-mono">
                      STALE
                    </span>
                  )}
                </div>
              </div>

              {/* Telemetry Strip */}
              <div className="grid grid-cols-4 gap-2 mt-5 pt-3 border-t border-[#303030] text-center font-mono">
                <div className="bg-[#171717] p-2 border border-[#303030]/60">
                  <div className="text-[9px] text-[#6E6E6E] uppercase">TEMP</div>
                  <div className={`text-xs font-bold mt-0.5 ${m.latest_temperature && m.latest_temperature > 70 ? 'text-[#FF554A]' : 'text-[#F4F4F4]'}`}>
                    {m.latest_temperature ? `${m.latest_temperature.toFixed(1)}°` : '--'}
                  </div>
                </div>
                <div className="bg-[#171717] p-2 border border-[#303030]/60">
                  <div className="text-[9px] text-[#6E6E6E] uppercase">VIB</div>
                  <div className={`text-xs font-bold mt-0.5 ${m.latest_vibration && m.latest_vibration > 4.0 ? 'text-[#FFD629]' : 'text-[#F4F4F4]'}`}>
                    {m.latest_vibration ? `${m.latest_vibration.toFixed(2)}` : '--'}
                  </div>
                </div>
                <div className="bg-[#171717] p-2 border border-[#303030]/60">
                  <div className="text-[9px] text-[#6E6E6E] uppercase">CURRENT</div>
                  <div className="text-xs font-bold text-[#F4F4F4] mt-0.5">
                    {m.latest_current ? `${m.latest_current.toFixed(1)}A` : '--'}
                  </div>
                </div>
                <div className="bg-[#171717] p-2 border border-[#303030]/60">
                  <div className="text-[9px] text-[#6E6E6E] uppercase">SPEED</div>
                  <div className="text-xs font-bold text-[#F4F4F4] mt-0.5">
                    {m.latest_rpm ? `${Math.round(m.latest_rpm)}` : '--'}
                  </div>
                </div>
              </div>

              {/* Risk Scale */}
              <div className="mt-4 pt-3 border-t border-[#303030]/60 font-mono">
                <div className="flex justify-between text-[11px] mb-1.5">
                  <span className="text-[#6E6E6E] uppercase">Anomaly Risk Score</span>
                  <span className="font-bold text-white">{m.risk_score.toFixed(0)}/100</span>
                </div>
                <div className="h-1.5 w-full bg-[#171717] overflow-hidden border border-[#303030]">
                  <div
                    className={`h-full transition-all duration-500 ${
                      m.risk_score >= 75
                        ? 'bg-[#FF554A]'
                        : m.risk_score >= 50
                        ? 'bg-[#FF554A]'
                        : m.risk_score >= 25
                        ? 'bg-[#F5B942]'
                        : 'bg-[#72C99A]'
                    }`}
                    style={{ width: `${Math.max(m.risk_score, 4)}%` }}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 9 & 10. INCIDENT FEED & AUTONOMOUS MAINTENANCE QUEUE */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Incident Alerts */}
        <div className="p-6 bg-[#111111] border border-[#303030]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#303030]">
            <div className="flex items-center gap-2">
              <span className="natgeo-mark-sm" />
              <h3 className="text-xs font-mono tracking-widest text-[#F4F4F4] uppercase font-bold">
                ACTIVE INCIDENT ALERTS
              </h3>
            </div>
            <Link to="/alerts" className="text-xs text-[#FFD629] hover:underline font-mono uppercase">
              Incident Feed ({data?.active_alerts ?? 0})
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-[10px] text-[#6E6E6E] uppercase border-b border-[#303030]">
                <tr>
                  <th className="pb-2">ASSET</th>
                  <th className="pb-2">ANOMALY TYPE</th>
                  <th className="pb-2">SEVERITY</th>
                  <th className="pb-2">STATUS</th>
                  <th className="pb-2 text-right">TIME</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#303030]">
                {data && data.recent_alerts.length > 0 ? (
                  data.recent_alerts.map((alert) => (
                    <tr key={alert.id} className="hover:bg-[#171717] transition-colors">
                      <td className="py-3 text-[#FFD629] font-bold">{alert.machine_code}</td>
                      <td className="py-3 text-[#F4F4F4] truncate max-w-[150px]">
                        {alert.alert_type.replace(/_/g, ' ')}
                      </td>
                      <td className="py-3">
                        <StatusBadge status={alert.severity} size="sm" />
                      </td>
                      <td className="py-3">
                        <StatusBadge status={alert.status} size="sm" />
                      </td>
                      <td className="py-3 text-right text-[#A3A3A3]">
                        {new Date(alert.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#6E6E6E]">
                      All monitored assets operational within nominal parameters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Maintenance Queue */}
        <div className="p-6 bg-[#111111] border border-[#303030]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#303030]">
            <div className="flex items-center gap-2">
              <span className="natgeo-mark-sm" />
              <h3 className="text-xs font-mono tracking-widest text-[#F4F4F4] uppercase font-bold">
                AUTONOMOUS DISPATCH QUEUE
              </h3>
            </div>
            <Link to="/tasks" className="text-xs text-[#FFD629] hover:underline font-mono uppercase">
              Work Orders ({data?.open_maintenance_tasks ?? 0})
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="text-[10px] text-[#6E6E6E] uppercase border-b border-[#303030]">
                <tr>
                  <th className="pb-2">TASK TITLE</th>
                  <th className="pb-2">TARGET</th>
                  <th className="pb-2">PRIORITY</th>
                  <th className="pb-2">STATUS</th>
                  <th className="pb-2 text-right">DISPATCHED</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#303030]">
                {data && data.recent_tasks.length > 0 ? (
                  data.recent_tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-[#171717] transition-colors">
                      <td className="py-3 text-[#F4F4F4] truncate max-w-[170px]" title={task.title}>
                        {task.title}
                      </td>
                      <td className="py-3 text-[#FFD629] font-bold">{task.machine_code}</td>
                      <td className="py-3">
                        <StatusBadge status={task.priority} size="sm" />
                      </td>
                      <td className="py-3">
                        <StatusBadge status={task.status} size="sm" />
                      </td>
                      <td className="py-3 text-right text-[#A3A3A3]">
                        {new Date(task.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-[#6E6E6E]">
                      Autonomous maintenance agent on standby. No open work orders.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};
