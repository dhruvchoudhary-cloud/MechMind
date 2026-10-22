import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { TopNavbar } from './components/TopNavbar';
import { OverviewDashboard } from './pages/OverviewDashboard';
import { MachineMonitoring } from './pages/MachineMonitoring';
import { MachineDetailPage } from './pages/MachineDetailPage';
import { AlertsPage } from './pages/AlertsPage';
import { TasksPage } from './pages/TasksPage';
import { SettingsPage } from './pages/SettingsPage';
import { SimulatorProvider } from './context/SimulatorContext';
import { api } from './services/api';

export const AppContent: React.FC = () => {
  const [collapsed, setCollapsed] = useState<boolean>(false);
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(new Date());
  const [isBackendHealthy, setIsBackendHealthy] = useState<boolean>(true);
  const [mlStatus, setMlStatus] = useState<string>('loaded');
  const [activeAlertCount, setActiveAlertCount] = useState<number>(0);
  const [openTaskCount, setOpenTaskCount] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const isFetchingRef = useRef<boolean>(false);

  const fetchGlobalState = async () => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      setIsRefreshing(true);
      const health = await api.checkBackendHealth();
      setIsBackendHealthy(health.status === 'healthy');
      setMlStatus(health.ml_status || 'loaded');

      // Update counters from summary
      const summary = await api.fetchDashboardSummary();
      setActiveAlertCount(summary.active_alerts);
      setOpenTaskCount(summary.open_maintenance_tasks);
      setLastUpdated(new Date());
    } catch {
      setIsBackendHealthy(false);
      setMlStatus('fallback_mode');
    } finally {
      setIsRefreshing(false);
      isFetchingRef.current = false;
    }
  };

  useEffect(() => {
    fetchGlobalState();
    const interval = setInterval(fetchGlobalState, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#050505] text-[#F4F4F4] flex overflow-x-hidden">
      {/* Persistent Collapsible Sidebar with Mobile Drawer support */}
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed(!collapsed)}
        activeAlertCount={activeAlertCount}
        openTaskCount={openTaskCount}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ease-in-out ml-0 ${
          collapsed ? 'md:ml-20' : 'md:ml-64'
        } overflow-x-hidden w-full max-w-full`}
      >
        {/* Top Navbar */}
        <TopNavbar
          lastUpdated={lastUpdated}
          isBackendHealthy={isBackendHealthy}
          mlStatus={mlStatus}
          onRefresh={fetchGlobalState}
          isRefreshing={isRefreshing}
          onToggleMobile={() => setMobileOpen(!mobileOpen)}
        />

        {/* Page Routing Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-[1680px] w-full mx-auto overflow-x-hidden">
          <Routes>
            <Route path="/" element={<OverviewDashboard />} />
            <Route path="/machines" element={<MachineMonitoring />} />
            <Route path="/machines/:machineId" element={<MachineDetailPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <SimulatorProvider>
        <AppContent />
      </SimulatorProvider>
    </BrowserRouter>
  );
};

export default App;
