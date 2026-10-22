import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Cpu,
  Search,
  Filter,
  Thermometer,
  Activity,
  Zap,
  RotateCw,
  ExternalLink,
  AlertCircle,
  Brain,
  ShieldCheck,
  Flame,
  ArrowRight
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
import { MachineSummary, ReadingItem } from '../types';
import { StatusBadge } from '../components/StatusBadge';

export const MachineMonitoring: React.FC = () => {
  const navigate = useNavigate();
  const [machines, setMachines] = useState<MachineSummary[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedMachineCode, setSelectedMachineCode] = useState<string>('motor-001');
  const [machineReadings, setMachineReadings] = useState<ReadingItem[]>([]);

  const loadMachines = async () => {
    try {
      const data = await api.fetchMachines();
      setMachines(data);
      if (data.length > 0 && !data.some((m) => m.machine_code === selectedMachineCode)) {
        setSelectedMachineCode(data[0].machine_code);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const loadReadings = async (code: string) => {
    try {
      const r = await api.fetchMachineReadings(code, 30);
      setMachineReadings(r);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadMachines();
    const interval = setInterval(loadMachines, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (selectedMachineCode) {
      loadReadings(selectedMachineCode);
      const interval = setInterval(() => loadReadings(selectedMachineCode), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedMachineCode]);

  const machineTypes = Array.from(new Set(machines.map((m) => m.machine_type)));

  const filteredMachines = machines.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.machine_code.toLowerCase().includes(search.toLowerCase()) ||
      m.location.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' || m.risk_level.toLowerCase() === statusFilter.toLowerCase();

    const matchesType = typeFilter === 'all' || m.machine_type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const selectedMachine = machines.find((m) => m.machine_code === selectedMachineCode) || machines[0];

  const chartData = machineReadings.map((r) => ({
    time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    temp: r.temperature_c,
    vib: r.vibration_mm_s_rms,
    current: r.current_a,
    rpm: r.rpm,
  }));

  // Diagnostic Interpretation for "Inside the Machine"
  const getDiagnosticHypotheses = (machine?: MachineSummary) => {
    if (!machine) return null;
    const isOverheating = machine.latest_temperature && machine.latest_temperature > 70.0;
    const isVibrating = machine.latest_vibration && machine.latest_vibration > 4.0;
    const isHighRisk = machine.risk_score >= 50.0;

    let signal = 'Normal harmonic vibration velocity and thermal baseline. All operating parameters within class tolerances.';
    let interpretation = 'No imminent component degradation detected. Electromagnetic and mechanical balance nominal.';
    let action = 'Maintain scheduled baseline telemetry monitoring. No corrective action required.';

    if (isOverheating && isVibrating) {
      signal = `Combined thermal elevation (${machine.latest_temperature?.toFixed(1)}°C) and severe vibration (${machine.latest_vibration?.toFixed(2)} mm/s RMS).`;
      interpretation = 'Severe mechanical stress: impending bearing seizure, dynamic rotor misalignment, or structural resonance breakdown.';
      action = 'Trigger immediate manual inspection, lubricate drive-end bearings, and verify coupling alignment before catastrophic shutdown.';
    } else if (isOverheating) {
      signal = `Thermal elevation observed (${machine.latest_temperature?.toFixed(1)}°C exceeding warning threshold).`;
      interpretation = 'Cooling fan obstruction, high ambient temperature, bearing friction, or stator electrical overload.';
      action = 'Inspect ventilation cowl, measure airflow resistance, and verify phase current balance across windings.';
    } else if (isVibrating) {
      signal = `Vibration velocity excursion (${machine.latest_vibration?.toFixed(2)} mm/s RMS exceeding ISO warning limit).`;
      interpretation = 'Rotor mass unbalance, bearing race spalling, looseness in foundation anchor bolts, or angular misalignment.';
      action = 'Perform vibration FFT spectral analysis (1X/2X harmonics), inspect foundation bolts, and check flexible coupling.';
    } else if (isHighRisk) {
      signal = 'Multivariate statistical deviation flagged by Isolation Forest without threshold breach.';
      interpretation = 'Non-linear correlation drift between current consumption, RPM, and temperature.';
      action = 'Review electrical supply power quality and mechanical load variance.';
    }

    return { signal, interpretation, action };
  };

  const diagnostics = getDiagnosticHypotheses(selectedMachine);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#303030]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="natgeo-mark-sm" />
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#F4F4F4] uppercase font-mono">
              MACHINE ASSET INTELLIGENCE EXPLORER
            </h1>
          </div>
          <p className="text-xs text-[#A3A3A3] mt-1 font-mono">
            Surveillance of rotating induction motors, vibrational velocity harmonics, and multivariate thermal drift
          </p>
        </div>

        {/* Search & Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#6E6E6E] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Filter machine code / location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-[#111111] border border-[#303030] text-xs font-mono text-[#F4F4F4] placeholder-[#6E6E6E] focus:outline-none focus:border-[#FFD629] w-56"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-[#111111] border border-[#303030] px-2.5 py-1 text-xs font-mono">
            <Filter className="w-3.5 h-3.5 text-[#6E6E6E]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-[#A3A3A3] focus:outline-none text-xs font-mono uppercase"
            >
              <option value="all" className="bg-[#111111]">All Risk Tiers</option>
              <option value="low" className="bg-[#111111]">Low Risk</option>
              <option value="medium" className="bg-[#111111]">Medium Risk</option>
              <option value="high" className="bg-[#111111]">High Risk</option>
              <option value="critical" className="bg-[#111111]">Critical Risk</option>
            </select>
          </div>
        </div>
      </div>

      {/* 6. MASTER-DETAIL EDITORIAL SPLIT LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Machine Asset Index (4 cols) */}
        <div className="lg:col-span-4 space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-[#6E6E6E] px-1 flex items-center justify-between">
            <span>INDEX OF MONITORED UNITS</span>
            <span>{filteredMachines.length} ASSETS</span>
          </div>

          <div className="space-y-3">
            {filteredMachines.map((m) => {
              const isSelected = m.machine_code === selectedMachineCode;
              return (
                <div
                  key={m.id}
                  onClick={() => setSelectedMachineCode(m.machine_code)}
                  className={`p-4 bg-[#111111] border transition-all duration-150 cursor-pointer text-left relative ${
                    isSelected
                      ? 'border-[#FFD629] bg-[#171717] border-l-4'
                      : 'border-[#303030] hover:border-[#6E6E6E] hover:bg-[#141414]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className={`font-bold ${isSelected ? 'text-[#FFD629]' : 'text-white'}`}>
                          {m.machine_code}
                        </span>
                        <span className="text-[#6E6E6E]">/</span>
                        <span className="text-[#A3A3A3] text-[11px] truncate max-w-[120px]">{m.location}</span>
                      </div>
                      <h4 className="font-bold text-sm text-[#F4F4F4] mt-1">{m.name}</h4>
                      <span className="text-[10px] font-mono text-[#6E6E6E] uppercase">{m.machine_type}</span>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <StatusBadge status={m.risk_level} size="sm" />
                      {m.is_stale && (
                        <span className="text-[9px] bg-[#F5B942]/10 text-[#F5B942] border border-[#F5B942] px-1 py-0.2 font-mono">
                          STALE
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Telemetry Preview Values */}
                  <div className="grid grid-cols-4 gap-1.5 mt-3 pt-2.5 border-t border-[#303030] text-center font-mono">
                    <div className="bg-[#0B0B0B] p-1 border border-[#303030]/60">
                      <div className="text-[8px] text-[#6E6E6E]">TEMP</div>
                      <div className="text-[11px] font-bold text-[#F4F4F4]">
                        {m.latest_temperature ? `${m.latest_temperature.toFixed(0)}°C` : '--'}
                      </div>
                    </div>
                    <div className="bg-[#0B0B0B] p-1 border border-[#303030]/60">
                      <div className="text-[8px] text-[#6E6E6E]">VIB</div>
                      <div className="text-[11px] font-bold text-[#F4F4F4]">
                        {m.latest_vibration ? `${m.latest_vibration.toFixed(1)}` : '--'}
                      </div>
                    </div>
                    <div className="bg-[#0B0B0B] p-1 border border-[#303030]/60">
                      <div className="text-[8px] text-[#6E6E6E]">CURR</div>
                      <div className="text-[11px] font-bold text-[#F4F4F4]">
                        {m.latest_current ? `${m.latest_current.toFixed(1)}A` : '--'}
                      </div>
                    </div>
                    <div className="bg-[#0B0B0B] p-1 border border-[#303030]/60">
                      <div className="text-[8px] text-[#6E6E6E]">RPM</div>
                      <div className="text-[11px] font-bold text-[#F4F4F4]">
                        {m.latest_rpm ? `${Math.round(m.latest_rpm)}` : '--'}
                      </div>
                    </div>
                  </div>

                  {/* Risk Bar */}
                  <div className="mt-2.5 flex items-center justify-between text-[10px] font-mono text-[#6E6E6E]">
                    <span>RISK SCORE:</span>
                    <span className="font-bold text-[#F4F4F4]">{m.risk_score.toFixed(0)}/100</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Expansive Editorial Dossier for Selected Machine (8 cols) */}
        {selectedMachine ? (
          <div className="lg:col-span-8 space-y-6">
            {/* Cinematic Mechanical Banner */}
            <div className="relative bg-[#0B0B0B] border border-[#303030] overflow-hidden">
              <div className="absolute inset-0 z-0">
                <img
                  src="/assets/turbine_detail.jpg"
                  alt="Turbine Detail"
                  className="w-full h-full object-cover object-center opacity-30"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/85 to-transparent" />
              </div>

              <div className="relative z-10 p-6 sm:p-8">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 font-mono text-xs text-[#FFD629] mb-1">
                      <span className="natgeo-mark-sm" />
                      <span className="font-bold tracking-wider">{selectedMachine.machine_code}</span>
                      <span className="text-[#6E6E6E]">/</span>
                      <span className="text-[#A3A3A3]">{selectedMachine.location}</span>
                    </div>

                    <h2 className="text-2xl sm:text-3xl font-black text-[#F4F4F4] tracking-tight uppercase">
                      {selectedMachine.name}
                    </h2>

                    <div className="flex items-center gap-3 mt-2 text-xs font-mono text-[#A3A3A3]">
                      <span>TYPE: <b className="text-[#F4F4F4]">{selectedMachine.machine_type}</b></span>
                      <span>•</span>
                      <span>NOMINAL: <b className="text-[#F4F4F4]">{selectedMachine.latest_rpm ? `${Math.round(selectedMachine.latest_rpm)} RPM` : '1500 RPM'}</b></span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end gap-2">
                    <StatusBadge status={selectedMachine.risk_level} size="lg" />
                    <Link
                      to={`/machines/${selectedMachine.machine_code}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFD629] hover:bg-yellow-400 text-black font-mono font-bold text-xs uppercase tracking-wider transition-colors mt-2"
                    >
                      <span>Full Diagnostics</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Primary Metric Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-[#303030]/80 font-mono">
                  <div className="p-3 bg-[#111111]/90 border border-[#303030]">
                    <div className="text-[10px] text-[#6E6E6E] uppercase">TEMPERATURE</div>
                    <div className={`text-2xl font-bold mt-1 ${selectedMachine.latest_temperature && selectedMachine.latest_temperature > 70 ? 'text-[#FF554A]' : 'text-[#F4F4F4]'}`}>
                      {selectedMachine.latest_temperature ? `${selectedMachine.latest_temperature.toFixed(1)}°C` : '--'}
                    </div>
                    <div className="text-[10px] text-[#A3A3A3] mt-0.5">Threshold: 70 / 85°C</div>
                  </div>

                  <div className="p-3 bg-[#111111]/90 border border-[#303030]">
                    <div className="text-[10px] text-[#6E6E6E] uppercase">VIBRATION RMS</div>
                    <div className={`text-2xl font-bold mt-1 ${selectedMachine.latest_vibration && selectedMachine.latest_vibration > 4.0 ? 'text-[#FFD629]' : 'text-[#F4F4F4]'}`}>
                      {selectedMachine.latest_vibration ? `${selectedMachine.latest_vibration.toFixed(2)}` : '--'}
                    </div>
                    <div className="text-[10px] text-[#A3A3A3] mt-0.5">ISO Limit: 4.5 mm/s</div>
                  </div>

                  <div className="p-3 bg-[#111111]/90 border border-[#303030]">
                    <div className="text-[10px] text-[#6E6E6E] uppercase">MOTOR CURRENT</div>
                    <div className="text-2xl font-bold text-[#F4F4F4] mt-1">
                      {selectedMachine.latest_current ? `${selectedMachine.latest_current.toFixed(1)} A` : '--'}
                    </div>
                    <div className="text-[10px] text-[#A3A3A3] mt-0.5">Operating Draw</div>
                  </div>

                  <div className="p-3 bg-[#111111]/90 border border-[#303030]">
                    <div className="text-[10px] text-[#6E6E6E] uppercase">SPEED (RPM)</div>
                    <div className="text-2xl font-bold text-[#F4F4F4] mt-1">
                      {selectedMachine.latest_rpm ? `${Math.round(selectedMachine.latest_rpm)}` : '--'}
                    </div>
                    <div className="text-[10px] text-[#A3A3A3] mt-0.5">Shaft Velocity</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Telemetry Chart */}
            <div className="p-6 bg-[#111111] border border-[#303030]">
              <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#303030]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-[#FFD629]" />
                  <h3 className="text-xs font-mono font-bold tracking-widest text-[#F4F4F4] uppercase">
                    HIGH-RESOLUTION SENSOR TELEMETRY TRACE
                  </h3>
                </div>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="flex items-center gap-1.5 text-[#FF554A]">
                    <span className="w-2.5 h-1 bg-[#FF554A]" /> Temperature
                  </span>
                  <span className="flex items-center gap-1.5 text-[#FFD629]">
                    <span className="w-2.5 h-1 bg-[#FFD629]" /> Vibration RMS
                  </span>
                </div>
              </div>

              <div className="h-64 w-full">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="#303030" strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="time" stroke="#6E6E6E" fontSize={10} tickLine={false} />
                      <YAxis stroke="#6E6E6E" fontSize={11} domain={['auto', 'auto']} tickLine={false} />
                      <Tooltip />
                      <ReferenceLine y={70} stroke="#F5B942" strokeDasharray="4 4" />
                      <ReferenceLine y={85} stroke="#FF554A" strokeDasharray="4 4" />
                      <Line type="monotone" dataKey="temp" stroke="#FF554A" strokeWidth={2} dot={false} isAnimationActive={false} />
                      <Line type="monotone" dataKey="vib" stroke="#FFD629" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs font-mono text-[#6E6E6E]">
                    Awaiting telemetry readings...
                  </div>
                )}
              </div>
            </div>

            {/* 8. AI INTELLIGENCE / DIAGNOSTICS PANEL — “Inside the Machine” */}
            <div className="p-6 bg-[#111111] border border-[#303030] relative">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#FFD629]" />

              <div className="flex items-center justify-between pb-4 border-b border-[#303030]">
                <div className="flex items-center gap-2.5">
                  <span className="natgeo-mark-sm" />
                  <div>
                    <h3 className="text-base font-bold tracking-wider text-[#F4F4F4] uppercase font-mono">
                      INSIDE THE MACHINE
                    </h3>
                    <span className="text-[10px] font-mono text-[#A3A3A3] uppercase">
                      DUAL-ENGINE ANOMALY DIAGNOSTIC DOSSIER
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-[#6E6E6E]">ENGINE:</span>
                  <span className="text-[#72C99A] font-semibold">ISOLATION FOREST + PHYSICAL RULES</span>
                </div>
              </div>

              {/* Risk Dial & Anomaly Status */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-6 p-4 bg-[#171717] border border-[#303030]">
                {/* Focal Risk Score */}
                <div className="flex flex-col justify-center">
                  <span className="text-[10px] font-mono text-[#6E6E6E] uppercase tracking-wider">
                    CALCULATED RISK SCORE
                  </span>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className={`text-4xl sm:text-5xl font-mono font-bold ${
                      selectedMachine.risk_score >= 50 ? 'text-[#FF554A]' : selectedMachine.risk_score >= 25 ? 'text-[#F5B942]' : 'text-[#72C99A]'
                    }`}>
                      {selectedMachine.risk_score.toFixed(0)}
                    </span>
                    <span className="text-sm font-mono text-[#6E6E6E]">/ 100</span>
                  </div>
                  <span className="text-xs font-mono text-[#A3A3A3] mt-1 uppercase font-semibold">
                    CLASSIFICATION: {selectedMachine.risk_level.toUpperCase()} RISK
                  </span>
                </div>

                {/* Risk Gauge Bar */}
                <div className="md:col-span-2 flex flex-col justify-center font-mono">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-[#A3A3A3]">Degradation Severity Scale</span>
                    <span className="text-[#FFD629] font-bold">{selectedMachine.risk_score.toFixed(1)}%</span>
                  </div>
                  <div className="h-3 w-full bg-[#0B0B0B] border border-[#303030] overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        selectedMachine.risk_score >= 75
                          ? 'bg-[#FF554A]'
                          : selectedMachine.risk_score >= 50
                          ? 'bg-[#FF554A]'
                          : selectedMachine.risk_score >= 25
                          ? 'bg-[#F5B942]'
                          : 'bg-[#72C99A]'
                      }`}
                      style={{ width: `${Math.max(selectedMachine.risk_score, 4)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-[#6E6E6E] mt-1.5">
                    <span>0 (NOMINAL)</span>
                    <span>25 (MODERATE)</span>
                    <span>50 (ELEVATED)</span>
                    <span>75 (CRITICAL)</span>
                  </div>
                </div>
              </div>

              {/* Three-Tier Diagnostic Hierarchy */}
              {diagnostics && (
                <div className="space-y-4 pt-2 font-mono">
                  <div className="p-3.5 bg-[#0B0B0B] border border-[#303030]">
                    <div className="text-[10px] text-[#FFD629] font-bold uppercase tracking-wider mb-1">
                      01 / DETECTED SIGNAL
                    </div>
                    <div className="text-xs text-[#F4F4F4] leading-relaxed">
                      {diagnostics.signal}
                    </div>
                  </div>

                  <div className="p-3.5 bg-[#0B0B0B] border border-[#303030]">
                    <div className="text-[10px] text-[#F5B942] font-bold uppercase tracking-wider mb-1">
                      02 / POSSIBLE INTERPRETATION
                    </div>
                    <div className="text-xs text-[#A3A3A3] leading-relaxed">
                      {diagnostics.interpretation}
                    </div>
                  </div>

                  <div className="p-3.5 bg-[#0B0B0B] border border-[#303030]">
                    <div className="text-[10px] text-[#72C99A] font-bold uppercase tracking-wider mb-1">
                      03 / RECOMMENDED ACTION
                    </div>
                    <div className="text-xs text-[#F4F4F4] leading-relaxed font-sans">
                      {diagnostics.action}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
