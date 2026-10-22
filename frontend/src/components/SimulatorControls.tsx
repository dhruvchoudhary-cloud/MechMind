import React, { useState } from 'react';
import {
  Play,
  Square,
  Thermometer,
  Activity,
  Flame,
  ShieldCheck,
  RotateCcw,
  Target,
  ArrowRight,
  Zap,
  Info
} from 'lucide-react';
import { useSimulator } from '../context/SimulatorContext';
import { SimulationScenario } from '../types';

interface SimulatorControlsProps {
  onUpdate: () => void;
}

export const SimulatorControls: React.FC<SimulatorControlsProps> = ({ onUpdate }) => {
  const [targetMachine, setTargetMachine] = useState<string>('');
  const {
    currentScenario,
    isRunning,
    actionLoading,
    notification,
    triggerScenario,
    toggleAutoLoop,
    resetDemo,
    triggerTick
  } = useSimulator();

  const handleScenario = async (sc: SimulationScenario) => {
    await triggerScenario(sc, targetMachine || undefined);
    onUpdate();
  };

  const handleToggle = async () => {
    await toggleAutoLoop();
    onUpdate();
  };

  const handleReset = async () => {
    await resetDemo();
    onUpdate();
  };

  const handleTick = async () => {
    await triggerTick();
    onUpdate();
  };

  // 5-step operational pipeline
  const eventSteps = [
    { num: '01', label: 'Telemetry Changes', desc: 'Sensor payload injected' },
    { num: '02', label: 'Dual Detection', desc: 'Rules & Isolation Forest' },
    { num: '03', label: 'Risk Assessment', desc: 'Heuristic scoring (0-100)' },
    { num: '04', label: 'Incident Deduplicated', desc: 'Alert logged / escalated' },
    { num: '05', label: 'Autonomous Task', desc: 'Work order dispatched' },
  ];

  return (
    <div className="bg-[#111111] border border-[#303030] p-5 mb-8 relative">
      {/* Editorial top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#FFD629]" />

      {/* Header and Title */}
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 pb-4 border-b border-[#303030]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="natgeo-mark-sm" />
            <h2 className="text-base font-bold tracking-wider text-[#F4F4F4] uppercase font-mono">
              TEST THE UNEXPECTED
            </h2>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 border border-[#303030] bg-[#171717] text-[#A3A3A3]">
              SIMULATION CONTROL CENTER
            </span>
          </div>
          <p className="text-xs text-[#A3A3A3] mt-1 max-w-3xl leading-relaxed">
            Inject synthetic physical degradation into the sensor stream to observe automated anomaly detection, risk quantification, and autonomous maintenance dispatch.
          </p>
        </div>

        {/* Live Status Indicators */}
        <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
          <div className="px-2.5 py-1 bg-[#171717] border border-[#303030] flex items-center gap-2">
            <span className={`w-2 h-2 ${isRunning ? 'bg-[#72C99A]' : 'bg-[#F5B942]'}`} />
            <span className="text-[#A3A3A3]">STREAM:</span>
            <span className="text-[#F4F4F4] font-semibold">{isRunning ? 'CONTINUOUS' : 'PAUSED'}</span>
          </div>

          <div className="px-2.5 py-1 bg-[#171717] border border-[#303030] flex items-center gap-2">
            <span className="text-[#A3A3A3]">SCENARIO:</span>
            <span className="text-[#FFD629] font-bold uppercase">{currentScenario.replace(/_/g, ' ')}</span>
          </div>

          <div className="px-2.5 py-1 bg-[#171717] border border-[#303030] flex items-center gap-2">
            <span className="text-[#A3A3A3]">TARGET:</span>
            <span className="text-[#F4F4F4] font-semibold">{targetMachine ? targetMachine.toUpperCase() : 'ALL FLEET'}</span>
          </div>
        </div>
      </div>

      {/* Control Actions Row */}
      <div className="pt-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        {/* Scenario Selection Group */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Target Selector */}
          <div className="flex items-center gap-2 bg-[#171717] border border-[#303030] px-3 py-1.5 text-xs font-mono">
            <Target className="w-3.5 h-3.5 text-[#FFD629]" />
            <span className="text-[#6E6E6E] uppercase">TARGET:</span>
            <select
              value={targetMachine}
              onChange={(e) => setTargetMachine(e.target.value)}
              className="bg-transparent text-[#F4F4F4] font-mono text-xs focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-[#111111] text-[#F4F4F4]">All Fleet (Broadcast)</option>
              <option value="motor-001" className="bg-[#111111] text-[#F4F4F4]">motor-001 (Assembly Line)</option>
              <option value="motor-002" className="bg-[#111111] text-[#F4F4F4]">motor-002 (Conveyor)</option>
              <option value="motor-003" className="bg-[#111111] text-[#F4F4F4]">motor-003 (Chiller Pump)</option>
            </select>
          </div>

          {/* Scenario Buttons */}
          <button
            onClick={() => handleScenario('normal')}
            disabled={actionLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider font-semibold border transition-all ${
              currentScenario === 'normal'
                ? 'bg-[#FFD629] text-black border-[#FFD629]'
                : 'bg-[#171717] text-[#A3A3A3] hover:text-[#F4F4F4] border-[#303030] hover:border-[#6E6E6E]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Normal Operation</span>
          </button>

          <button
            onClick={() => handleScenario('overheating')}
            disabled={actionLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider font-semibold border transition-all ${
              currentScenario === 'overheating'
                ? 'bg-[#FFD629] text-black border-[#FFD629]'
                : 'bg-[#171717] text-[#A3A3A3] hover:text-[#F4F4F4] border-[#303030] hover:border-[#6E6E6E]'
            }`}
          >
            <Thermometer className="w-3.5 h-3.5" />
            <span>Overheating</span>
          </button>

          <button
            onClick={() => handleScenario('excessive_vibration')}
            disabled={actionLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider font-semibold border transition-all ${
              currentScenario === 'excessive_vibration'
                ? 'bg-[#FFD629] text-black border-[#FFD629]'
                : 'bg-[#171717] text-[#A3A3A3] hover:text-[#F4F4F4] border-[#303030] hover:border-[#6E6E6E]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Excessive Vibration</span>
          </button>

          <button
            onClick={() => handleScenario('combined_fault')}
            disabled={actionLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider font-semibold border transition-all ${
              currentScenario === 'combined_fault'
                ? 'bg-[#FFD629] text-black border-[#FFD629]'
                : 'bg-[#171717] text-[#A3A3A3] hover:text-[#F4F4F4] border-[#303030] hover:border-[#6E6E6E]'
            }`}
          >
            <Flame className="w-3.5 h-3.5" />
            <span>Combined Fault</span>
          </button>

          <button
            onClick={() => handleScenario('recovery')}
            disabled={actionLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider font-semibold border transition-all ${
              currentScenario === 'recovery'
                ? 'bg-[#FFD629] text-black border-[#FFD629]'
                : 'bg-[#171717] text-[#A3A3A3] hover:text-[#F4F4F4] border-[#303030] hover:border-[#6E6E6E]'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Recovery</span>
          </button>
        </div>

        {/* Engine Actions (Continuous Loop, Step Tick, Reset) */}
        <div className="flex items-center gap-2">
          {/* Pause / Start Continuous Loop */}
          <button
            onClick={handleToggle}
            disabled={actionLoading}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono uppercase tracking-wider font-semibold border transition-all ${
              isRunning
                ? 'bg-[#171717] hover:bg-[#202020] text-[#FF554A] border-[#FF554A]/50'
                : 'bg-[#171717] hover:bg-[#202020] text-[#72C99A] border-[#72C99A]/50'
            }`}
          >
            {isRunning ? (
              <>
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Pause Auto-Gen</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Auto-Gen</span>
              </>
            )}
          </button>

          {/* Step Tick */}
          <button
            onClick={handleTick}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#171717] hover:bg-[#202020] hover:border-[#FFD629] text-[#F4F4F4] text-xs font-mono uppercase tracking-wider font-semibold border border-[#303030] transition-colors"
            title="Inject single tick immediately"
          >
            <Zap className="w-3.5 h-3.5 text-[#FFD629]" />
            <span>Tick</span>
          </button>

          {/* Reset Demo */}
          <button
            onClick={handleReset}
            disabled={actionLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#171717] hover:bg-[#202020] hover:border-[#FF554A] text-[#A3A3A3] hover:text-[#FF554A] text-xs font-mono uppercase tracking-wider border border-[#303030] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Sequence of Events Pipeline */}
      <div className="mt-5 pt-4 border-t border-[#303030]/60">
        <div className="text-[10px] font-mono uppercase tracking-widest text-[#6E6E6E] mb-2 flex items-center gap-2">
          <span>EVENT LIFECYCLE PROGRESSION</span>
          <span className="text-[#303030]">/</span>
          <span className="text-[#A3A3A3]">AUTONOMOUS PIPELINE</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
          {eventSteps.map((step, idx) => (
            <div
              key={step.num}
              className="p-2.5 bg-[#0B0B0B] border border-[#303030] flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                <span className="text-[#FFD629] font-bold">{step.num}</span>
                <span className="text-[#6E6E6E]">PHASE</span>
              </div>
              <div className="text-xs font-mono font-semibold text-[#F4F4F4] uppercase">
                {step.label}
              </div>
              <div className="text-[10px] text-[#6E6E6E] mt-0.5">
                {step.desc}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Disclaimer */}
      <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-[#6E6E6E]">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-[#A3A3A3]" />
          <span>Simulated sensor telemetry is labelled for demonstration purposes. Risk scores represent heuristic anomaly indices.</span>
        </div>
        {notification && (
          <span className="text-[#FFD629] font-semibold">{notification}</span>
        )}
      </div>
    </div>
  );
};
