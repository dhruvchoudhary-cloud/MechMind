import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { SimulationScenario } from '../types';

interface SimulatorContextType {
  currentScenario: string;
  isRunning: boolean;
  actionLoading: boolean;
  notification: string | null;
  triggerScenario: (sc: SimulationScenario, machineId?: string) => Promise<void>;
  toggleAutoLoop: () => Promise<void>;
  resetDemo: () => Promise<void>;
  triggerTick: () => Promise<void>;
  showNotification: (msg: string) => void;
  syncStatus: () => Promise<void>;
}

const SimulatorContext = createContext<SimulatorContextType | undefined>(undefined);

export const SimulatorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentScenario, setCurrentScenario] = useState<string>('normal');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);
  const isPollingRef = useRef<boolean>(false);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  const syncStatus = async () => {
    if (isPollingRef.current) return; // Prevent overlapping requests (Issue 21)
    isPollingRef.current = true;
    try {
      const res = await api.getSimulatorStatus();
      setCurrentScenario(res.current_scenario);
      setIsRunning(res.is_running);
    } catch {
      // ignore
    } finally {
      isPollingRef.current = false;
    }
  };

  useEffect(() => {
    syncStatus();
    const timer = setInterval(syncStatus, 3000);
    return () => clearInterval(timer);
  }, []);

  const triggerScenario = async (sc: SimulationScenario, machineId?: string) => {
    try {
      setActionLoading(true);
      await api.triggerSimulatorScenario(sc, machineId);
      await api.triggerSimulatorTick();
      setCurrentScenario(sc);
      showNotification(`Scenario switched to: ${sc.replace('_', ' ').toUpperCase()}`);
    } catch (err: any) {
      showNotification(`Scenario trigger failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const toggleAutoLoop = async () => {
    try {
      setActionLoading(true);
      if (isRunning) {
        await api.stopSimulator();
        setIsRunning(false);
        showNotification("Autonomous telemetry streaming paused.");
      } else {
        await api.startSimulator();
        setIsRunning(true);
        showNotification("Autonomous telemetry streaming active.");
      }
    } catch (err: any) {
      showNotification(`Toggle failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const resetDemo = async () => {
    if (!window.confirm("Reset simulation state and clear active demo incidents?")) return;
    try {
      setActionLoading(true);
      await api.resetSimulation();
      setCurrentScenario('normal');
      setIsRunning(false);
      showNotification("Demo environment reset to baseline.");
    } catch (err: any) {
      showNotification(`Reset failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const triggerTick = async () => {
    try {
      setActionLoading(true);
      await api.triggerSimulatorTick();
      showNotification("Single simulated telemetry tick processed.");
    } catch (err: any) {
      showNotification(`Tick failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <SimulatorContext.Provider
      value={{
        currentScenario,
        isRunning,
        actionLoading,
        notification,
        triggerScenario,
        toggleAutoLoop,
        resetDemo,
        triggerTick,
        showNotification,
        syncStatus,
      }}
    >
      {children}
    </SimulatorContext.Provider>
  );
};

export const useSimulator = () => {
  const context = useContext(SimulatorContext);
  if (!context) {
    throw new Error('useSimulator must be used within a SimulatorProvider');
  }
  return context;
};
