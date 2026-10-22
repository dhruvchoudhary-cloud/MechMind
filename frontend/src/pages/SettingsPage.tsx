import React, { useState, useEffect } from 'react';
import {
  Settings,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Sliders,
  ShieldAlert,
  Info,
  Clock,
  Gauge,
  Thermometer,
  Activity,
  Zap,
  RotateCw
} from 'lucide-react';
import { api } from '../services/api';
import { SystemSettings } from '../types';

export const SettingsPage: React.FC = () => {
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

  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const loadSettings = async () => {
    try {
      const data = await api.fetchSettings();
      setSettings(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleChange = (key: keyof SystemSettings, value: number) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setValidationError(null);
  };

  const validateForm = (): boolean => {
    if (settings.temp_warning_c >= settings.temp_critical_c) {
      setValidationError(`Temperature warning (${settings.temp_warning_c}°C) must be strictly less than critical (${settings.temp_critical_c}°C).`);
      return false;
    }
    if (settings.vibration_warning_rms >= settings.vibration_critical_rms) {
      setValidationError(`Vibration warning (${settings.vibration_warning_rms} mm/s) must be strictly less than critical (${settings.vibration_critical_rms} mm/s).`);
      return false;
    }
    if (settings.current_min_a >= settings.current_max_a) {
      setValidationError(`Current minimum (${settings.current_min_a} A) must be strictly less than maximum (${settings.current_max_a} A).`);
      return false;
    }
    if (settings.rpm_min >= settings.rpm_max) {
      setValidationError(`RPM minimum (${settings.rpm_min}) must be strictly less than maximum (${settings.rpm_max}).`);
      return false;
    }
    if (!(settings.risk_low_max < settings.risk_medium_max && settings.risk_medium_max < settings.risk_high_max)) {
      setValidationError(`Risk score thresholds must be strictly ordered: Low (${settings.risk_low_max}) < Medium (${settings.risk_medium_max}) < High (${settings.risk_high_max}).`);
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSaving(true);
      await api.updateSettings(settings);
      setNotice("Configuration parameters successfully saved and synchronized with running simulator.");
      setTimeout(() => setNotice(null), 3500);
    } catch (err: any) {
      setValidationError(`Backend rejected settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    const defaults: SystemSettings = {
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
    };
    try {
      setSaving(true);
      setSettings(defaults);
      setValidationError(null);
      await api.updateSettings(defaults);
      setNotice("Demo default thresholds successfully restored and saved to SQLite.");
      setTimeout(() => setNotice(null), 3500);
    } catch (err: any) {
      setValidationError(`Failed to restore defaults: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-8 h-8 border-2 border-[#FFD629] border-t-transparent rounded-full animate-spin" />
        <span className="text-xs font-mono uppercase tracking-widest text-[#A3A3A3]">
          LOADING SYSTEM CALIBRATION SETTINGS...
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto animate-fade-in font-mono">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#303030]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="natgeo-mark-sm" />
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#F4F4F4] uppercase font-mono">
              SYSTEM CALIBRATION SPECIFICATION
            </h1>
          </div>
          <p className="text-xs text-[#A3A3A3] mt-1 font-mono">
            Autonomous rule thresholds, statistical risk engine boundaries, and telemetry ingestion timing
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#171717] hover:bg-[#222222] text-[#A3A3A3] hover:text-[#F4F4F4] text-xs uppercase tracking-wider border border-[#303030] transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restore Defaults</span>
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-[#171717] border border-[#FFD629] text-[#FFD629] text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{notice}</span>
        </div>
      )}

      {validationError && (
        <div className="p-3 bg-[#FF554A]/10 border border-[#FF554A] text-[#FF554A] text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{validationError}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Section 01: Thermal Limits */}
        <div className="p-6 bg-[#111111] border border-[#303030] relative">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#FF554A]" />
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#303030]">
            <Thermometer className="w-4 h-4 text-[#FF554A]" />
            <h3 className="text-xs uppercase font-bold tracking-widest text-[#F4F4F4]">
              01 / THERMAL PHYSICAL LIMITS (°C)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs text-[#A3A3A3] mb-1.5">
                TEMPERATURE WARNING THRESHOLD (°C)
              </label>
              <input
                type="number"
                step="0.5"
                min="20"
                max="150"
                value={settings.temp_warning_c}
                onChange={(e) => handleChange('temp_warning_c', parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 bg-[#171717] border border-[#303030] text-sm text-[#F4F4F4] focus:outline-none focus:border-[#FFD629]"
                required
              />
              <span className="text-[10px] text-[#6E6E6E] mt-1 block">Default: 70.0°C (Watchlist / Moderate Drift)</span>
            </div>

            <div>
              <label className="block text-xs text-[#A3A3A3] mb-1.5">
                TEMPERATURE CRITICAL THRESHOLD (°C)
              </label>
              <input
                type="number"
                step="0.5"
                min="30"
                max="200"
                value={settings.temp_critical_c}
                onChange={(e) => handleChange('temp_critical_c', parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 bg-[#171717] border border-[#303030] text-sm text-[#F4F4F4] focus:outline-none focus:border-[#FF554A]"
                required
              />
              <span className="text-[10px] text-[#6E6E6E] mt-1 block">Default: 85.0°C (Immediate Task Dispatch)</span>
            </div>
          </div>
        </div>

        {/* Section 02: Vibration Limits */}
        <div className="p-6 bg-[#111111] border border-[#303030] relative">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#FFD629]" />
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#303030]">
            <Activity className="w-4 h-4 text-[#FFD629]" />
            <h3 className="text-xs uppercase font-bold tracking-widest text-[#F4F4F4]">
              02 / VIBRATION VELOCITY LIMITS (MM/S RMS)
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs text-[#A3A3A3] mb-1.5">
                VIBRATION WARNING THRESHOLD (MM/S)
              </label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="30"
                value={settings.vibration_warning_rms}
                onChange={(e) => handleChange('vibration_warning_rms', parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 bg-[#171717] border border-[#303030] text-sm text-[#F4F4F4] focus:outline-none focus:border-[#FFD629]"
                required
              />
              <span className="text-[10px] text-[#6E6E6E] mt-1 block">Default: 4.0 mm/s (ISO Class II Warning)</span>
            </div>

            <div>
              <label className="block text-xs text-[#A3A3A3] mb-1.5">
                VIBRATION CRITICAL THRESHOLD (MM/S)
              </label>
              <input
                type="number"
                step="0.1"
                min="1.0"
                max="50"
                value={settings.vibration_critical_rms}
                onChange={(e) => handleChange('vibration_critical_rms', parseFloat(e.target.value) || 0)}
                className="w-full p-2.5 bg-[#171717] border border-[#303030] text-sm text-[#F4F4F4] focus:outline-none focus:border-[#FF554A]"
                required
              />
              <span className="text-[10px] text-[#6E6E6E] mt-1 block">Default: 6.5 mm/s (Severe Mechanical Degradation)</span>
            </div>
          </div>
        </div>

        {/* Section 03: Electrical & Rotational Bounds */}
        <div className="p-6 bg-[#111111] border border-[#303030]">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#303030]">
            <Zap className="w-4 h-4 text-[#72C99A]" />
            <h3 className="text-xs uppercase font-bold tracking-widest text-[#F4F4F4]">
              03 / ELECTRICAL CURRENT & SHAFT SPEED TOLERANCES
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-[#A3A3A3] mb-1.5">CURRENT MIN (A)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="50"
                value={settings.current_min_a}
                onChange={(e) => handleChange('current_min_a', parseFloat(e.target.value) || 0)}
                className="w-full p-2 bg-[#171717] border border-[#303030] text-sm text-[#F4F4F4] focus:outline-none focus:border-[#FFD629]"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#A3A3A3] mb-1.5">CURRENT MAX (A)</label>
              <input
                type="number"
                step="0.5"
                min="1"
                max="200"
                value={settings.current_max_a}
                onChange={(e) => handleChange('current_max_a', parseFloat(e.target.value) || 0)}
                className="w-full p-2 bg-[#171717] border border-[#303030] text-sm text-[#F4F4F4] focus:outline-none focus:border-[#FFD629]"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#A3A3A3] mb-1.5">RPM MIN</label>
              <input
                type="number"
                step="50"
                min="100"
                max="10000"
                value={settings.rpm_min}
                onChange={(e) => handleChange('rpm_min', parseFloat(e.target.value) || 0)}
                className="w-full p-2 bg-[#171717] border border-[#303030] text-sm text-[#F4F4F4] focus:outline-none focus:border-[#FFD629]"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-[#A3A3A3] mb-1.5">RPM MAX</label>
              <input
                type="number"
                step="50"
                min="200"
                max="20000"
                value={settings.rpm_max}
                onChange={(e) => handleChange('rpm_max', parseFloat(e.target.value) || 0)}
                className="w-full p-2 bg-[#171717] border border-[#303030] text-sm text-[#F4F4F4] focus:outline-none focus:border-[#FFD629]"
                required
              />
            </div>
          </div>
        </div>

        {/* Section 04: Risk Stratification Tiers */}
        <div className="p-6 bg-[#111111] border border-[#303030]">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#303030]">
            <Gauge className="w-4 h-4 text-[#F5B942]" />
            <h3 className="text-xs uppercase font-bold tracking-widest text-[#F4F4F4]">
              04 / RISK STRATIFICATION BOUNDARIES (0 - 100)
            </h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-[#A3A3A3] mb-1.5">LOW RISK MAX</label>
              <input
                type="number"
                min="1"
                max="80"
                value={settings.risk_low_max}
                onChange={(e) => handleChange('risk_low_max', parseInt(e.target.value) || 0)}
                className="w-full p-2 bg-[#171717] border border-[#303030] text-sm text-[#F4F4F4] focus:outline-none focus:border-[#72C99A]"
                required
              />
              <span className="text-[10px] text-[#6E6E6E] mt-1 block">Default: 24 (Nominal)</span>
            </div>
            <div>
              <label className="block text-xs text-[#A3A3A3] mb-1.5">MEDIUM RISK MAX</label>
              <input
                type="number"
                min="5"
                max="90"
                value={settings.risk_medium_max}
                onChange={(e) => handleChange('risk_medium_max', parseInt(e.target.value) || 0)}
                className="w-full p-2 bg-[#171717] border border-[#303030] text-sm text-[#F4F4F4] focus:outline-none focus:border-[#F5B942]"
                required
              />
              <span className="text-[10px] text-[#6E6E6E] mt-1 block">Default: 49 (Moderate)</span>
            </div>
            <div>
              <label className="block text-xs text-[#A3A3A3] mb-1.5">HIGH RISK MAX</label>
              <input
                type="number"
                min="10"
                max="99"
                value={settings.risk_high_max}
                onChange={(e) => handleChange('risk_high_max', parseInt(e.target.value) || 0)}
                className="w-full p-2 bg-[#171717] border border-[#303030] text-sm text-[#F4F4F4] focus:outline-none focus:border-[#FF554A]"
                required
              />
              <span className="text-[10px] text-[#6E6E6E] mt-1 block">Default: 74 (High / Imminent)</span>
            </div>
          </div>
        </div>

        {/* Section 05: Simulation Frequency */}
        <div className="p-6 bg-[#111111] border border-[#303030]">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#303030]">
            <Clock className="w-4 h-4 text-[#A3A3A3]" />
            <h3 className="text-xs uppercase font-bold tracking-widest text-[#F4F4F4]">
              05 / TELEMETRY SIMULATION LOOP FREQUENCY
            </h3>
          </div>

          <div className="max-w-md">
            <label className="block text-xs text-[#A3A3A3] mb-1.5">INTERVAL DURATION (SECONDS)</label>
            <input
              type="number"
              step="0.5"
              min="0.5"
              max="60"
              value={settings.simulation_interval_sec}
              onChange={(e) => handleChange('simulation_interval_sec', parseFloat(e.target.value) || 0)}
              className="w-full p-2.5 bg-[#171717] border border-[#303030] text-sm text-[#F4F4F4] focus:outline-none focus:border-[#FFD629]"
              required
            />
            <span className="text-[10px] text-[#6E6E6E] mt-1 block">Default: 2.5s (Background sensor generator frequency)</span>
          </div>
        </div>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-4 pt-4 border-t border-[#303030]">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#FFD629] hover:bg-yellow-400 text-black text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Synchronizing...' : 'Save & Synchronize Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
