import React from 'react';
import {
  RefreshCw,
  RotateCcw,
  Zap,
  CheckCircle2,
  AlertCircle,
  Menu,
  Activity,
  Cpu
} from 'lucide-react';
import { useSimulator } from '../context/SimulatorContext';
import { SimulationScenario } from '../types';

interface TopNavbarProps {
  lastUpdated: Date | null;
  isBackendHealthy: boolean;
  mlStatus?: string;
  onRefresh: () => void;
  isRefreshing: boolean;
  onToggleMobile?: () => void;
}

export const TopNavbar: React.FC<TopNavbarProps> = ({
  lastUpdated,
  isBackendHealthy,
  mlStatus = 'loaded',
  onRefresh,
  isRefreshing,
  onToggleMobile
}) => {
  const {
    currentScenario,
    actionLoading,
    notification,
    triggerScenario,
    resetDemo,
    triggerTick
  } = useSimulator();

  const handleScenarioClick = async (sc: SimulationScenario) => {
    await triggerScenario(sc);
    onRefresh();
  };

  const handleResetClick = async () => {
    await resetDemo();
    onRefresh();
  };

  const handleTickClick = async () => {
    await triggerTick();
    onRefresh();
  };

  return (
    <header className="h-16 border-b border-[#303030] bg-[#050505] sticky top-0 z-20 px-4 sm:px-6 flex items-center justify-between">
      {/* Left: Mobile Toggle, System Status & Telemetry Metadata */}
      <div className="flex items-center gap-3 sm:gap-5">
        {/* Mobile Sidebar Hamburger Toggle */}
        <button
          onClick={onToggleMobile}
          className="md:hidden p-2 bg-[#111111] border border-[#303030] text-[#A3A3A3] hover:text-[#FFD629] hover:border-[#FFD629] transition-colors"
          title="Toggle Navigation Menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Backend Online / Offline */}
        <div className="flex items-center gap-2">
          {isBackendHealthy ? (
            <div className="flex items-center gap-2 px-2.5 py-1 border border-[#303030] bg-[#111111] text-[#72C99A] text-xs font-mono">
              <span className="w-2 h-2 bg-[#72C99A]" />
              <span className="hidden sm:inline tracking-wider font-semibold">SYSTEM NOMINAL</span>
              <span className="sm:hidden tracking-wider font-semibold">ONLINE</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-2.5 py-1 border border-[#FF554A] bg-[#FF554A]/10 text-[#FF554A] text-xs font-mono">
              <span className="w-2 h-2 bg-[#FF554A]" />
              <span className="tracking-wider font-semibold">API OFFLINE</span>
            </div>
          )}
        </div>

        {/* ML Status / Fallback Badge */}
        {mlStatus === 'fallback_mode' ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 border border-[#F5B942] bg-[#F5B942]/10 text-[#F5B942] text-xs font-mono font-semibold">
            <span className="w-2 h-2 bg-[#F5B942]" />
            <span className="hidden sm:inline tracking-wider">ML FALLBACK (RULES ONLY)</span>
            <span className="sm:hidden tracking-wider">FALLBACK</span>
          </div>
        ) : (
          <div className="hidden xl:flex items-center gap-2 px-2.5 py-1 border border-[#303030] bg-[#111111] text-[#A3A3A3] text-xs font-mono">
            <Cpu className="w-3.5 h-3.5 text-[#FFD629]" />
            <span className="tracking-wider text-[#F4F4F4]">ML MODEL ACTIVE</span>
            <span className="text-[10px] text-[#6E6E6E]">v1.9.1</span>
          </div>
        )}

        {/* Timestamp */}
        <div className="hidden md:flex items-center gap-2 text-xs text-[#A3A3A3] font-mono">
          <span className="text-[#6E6E6E]">STREAM:</span>
          <span className="text-[#F4F4F4]">
            {lastUpdated ? lastUpdated.toLocaleTimeString() : '--:--:--'}
          </span>
        </div>

        {notification && (
          <div className="hidden 2xl:flex items-center gap-1.5 px-3 py-1 border border-[#FFD629]/40 bg-[#171717] text-[#FFD629] text-xs font-mono">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#FFD629]" />
            <span>{notification}</span>
          </div>
        )}
      </div>

      {/* Right: Quick Simulation Scenario Bar & Utility Controls */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        <div className="hidden xl:flex items-center bg-[#111111] border border-[#303030] p-1 text-xs font-mono">
          <span className="px-2 text-[#6E6E6E] uppercase tracking-wider text-[11px]">SCENARIO:</span>
          {(['normal', 'overheating', 'excessive_vibration', 'combined_fault', 'recovery'] as SimulationScenario[]).map((sc) => {
            const isSelected = currentScenario === sc;
            return (
              <button
                key={sc}
                disabled={actionLoading}
                onClick={() => handleScenarioClick(sc)}
                className={`px-2.5 py-1 transition-all text-xs uppercase tracking-wider font-semibold disabled:opacity-50 ${
                  isSelected
                    ? 'bg-[#FFD629] text-black shadow-sm'
                    : 'text-[#A3A3A3] hover:text-[#F4F4F4] hover:bg-[#171717]'
                }`}
              >
                {sc.replace(/_/g, ' ')}
              </button>
            );
          })}
        </div>

        {/* Step / Tick Button */}
        <button
          onClick={handleTickClick}
          disabled={actionLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111111] hover:bg-[#171717] hover:border-[#FFD629] disabled:opacity-50 text-[#F4F4F4] text-xs font-mono uppercase tracking-wider border border-[#303030] transition-colors"
          title="Inject single telemetry reading immediately"
        >
          <Zap className="w-3.5 h-3.5 text-[#FFD629]" />
          <span className="hidden sm:inline">Tick</span>
        </button>

        {/* Reset Demo */}
        <button
          onClick={handleResetClick}
          disabled={actionLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111111] hover:bg-[#171717] hover:border-[#FFD629] disabled:opacity-50 text-[#A3A3A3] hover:text-[#F4F4F4] text-xs font-mono uppercase tracking-wider border border-[#303030] transition-colors"
          title="Reset demo data"
        >
          <RotateCcw className="w-3.5 h-3.5 text-[#A3A3A3]" />
          <span className="hidden sm:inline">Reset</span>
        </button>

        {/* Manual Refresh */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-2 bg-[#111111] hover:bg-[#171717] hover:border-[#FFD629] text-[#A3A3A3] hover:text-[#FFD629] border border-[#303030] transition-colors"
          title="Refresh Dashboard Data"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#FFD629]' : ''}`} />
        </button>
      </div>
    </header>
  );
};
