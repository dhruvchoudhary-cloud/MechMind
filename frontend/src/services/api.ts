import {
  DashboardSummary,
  MachineSummary,
  MachineDetail,
  HealthAssessment,
  ReadingItem,
  AlertItem,
  MaintenanceTaskItem,
  SystemSettings,
  SimulationScenario
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let errorMsg = `API Request failed with status ${res.status}`;
    try {
      const errorData = await res.json();
      if (errorData.detail) {
        errorMsg = typeof errorData.detail === 'string' ? errorData.detail : JSON.stringify(errorData.detail);
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(errorMsg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  // System Health
  checkBackendHealth: async () => {
    const res = await fetch(`${API_BASE}/health`);
    return handleResponse<{ status: string; service: string; ml_status: string; model_version: string }>(res);
  },

  // Dashboard
  fetchDashboardSummary: async (): Promise<DashboardSummary> => {
    const res = await fetch(`${API_BASE}/dashboard/summary`);
    return handleResponse<DashboardSummary>(res);
  },

  // Machines
  fetchMachines: async (params?: { status?: string; machine_type?: string; search?: string; limit?: number; offset?: number; envelope?: boolean }): Promise<MachineSummary[]> => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.machine_type) query.append('machine_type', params.machine_type);
    if (params?.search) query.append('search', params.search);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    if (params?.envelope !== undefined) query.append('envelope', String(params.envelope));
    const res = await fetch(`${API_BASE}/machines?${query.toString()}`);
    const data = await handleResponse<any>(res);
    return Array.isArray(data) ? data : (data.items || []);
  },

  fetchMachineDetail: async (machineId: string | number): Promise<MachineDetail> => {
    const res = await fetch(`${API_BASE}/machines/${machineId}`);
    return handleResponse<MachineDetail>(res);
  },

  fetchMachineHealth: async (machineId: string | number): Promise<HealthAssessment> => {
    const res = await fetch(`${API_BASE}/machines/${machineId}/health`);
    return handleResponse<HealthAssessment>(res);
  },

  fetchMachineReadings: async (machineId: string | number, limit: number = 60): Promise<ReadingItem[]> => {
    const res = await fetch(`${API_BASE}/machines/${machineId}/readings?limit=${limit}`);
    return handleResponse<ReadingItem[]>(res);
  },

  // Alerts
  fetchAlerts: async (params?: { status?: string; severity?: string; machine_id?: string; limit?: number; offset?: number; envelope?: boolean }): Promise<AlertItem[]> => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.severity) query.append('severity', params.severity);
    if (params?.machine_id) query.append('machine_id', params.machine_id);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    if (params?.envelope !== undefined) query.append('envelope', String(params.envelope));
    const res = await fetch(`${API_BASE}/alerts?${query.toString()}`);
    const data = await handleResponse<any>(res);
    return Array.isArray(data) ? data : (data.items || []);
  },

  updateAlertStatus: async (alertId: number, status: 'active' | 'acknowledged' | 'resolved'): Promise<AlertItem> => {
    const res = await fetch(`${API_BASE}/alerts/${alertId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    return handleResponse<AlertItem>(res);
  },

  // Maintenance Tasks
  fetchTasks: async (params?: { status?: string; priority?: string; machine_id?: string; limit?: number; offset?: number; envelope?: boolean }): Promise<MaintenanceTaskItem[]> => {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.priority) query.append('priority', params.priority);
    if (params?.machine_id) query.append('machine_id', params.machine_id);
    if (params?.limit) query.append('limit', String(params.limit));
    if (params?.offset) query.append('offset', String(params.offset));
    if (params?.envelope !== undefined) query.append('envelope', String(params.envelope));
    const res = await fetch(`${API_BASE}/tasks?${query.toString()}`);
    const data = await handleResponse<any>(res);
    return Array.isArray(data) ? data : (data.items || []);
  },

  updateTask: async (taskId: number, data: { status?: string; notes?: string }): Promise<MaintenanceTaskItem> => {
    const res = await fetch(`${API_BASE}/tasks/${taskId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse<MaintenanceTaskItem>(res);
  },

  // Simulator Controls
  triggerSimulatorScenario: async (scenario: SimulationScenario, machineId?: string) => {
    const res = await fetch(`${API_BASE}/simulator/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario, machine_id: machineId || null })
    });
    return handleResponse<{ status: string; message: string; current_scenario: string }>(res);
  },

  resetSimulation: async () => {
    const res = await fetch(`${API_BASE}/simulator/reset`, { method: 'POST' });
    return handleResponse<{ status: string; message: string }>(res);
  },

  triggerSimulatorTick: async () => {
    const res = await fetch(`${API_BASE}/simulator/tick`, { method: 'POST' });
    return handleResponse<{ status: string; scenario: string; assessments: HealthAssessment[] }>(res);
  },

  startSimulator: async () => {
    const res = await fetch(`${API_BASE}/simulator/start`, { method: 'POST' });
    return handleResponse<{ status: string; is_running: boolean }>(res);
  },

  stopSimulator: async () => {
    const res = await fetch(`${API_BASE}/simulator/stop`, { method: 'POST' });
    return handleResponse<{ status: string; is_running: boolean }>(res);
  },

  getSimulatorStatus: async () => {
    const res = await fetch(`${API_BASE}/simulator/status`);
    return handleResponse<{ is_running: boolean; current_scenario: string; interval_seconds: number }>(res);
  },

  // Settings
  fetchSettings: async (): Promise<SystemSettings> => {
    const res = await fetch(`${API_BASE}/settings`);
    return handleResponse<SystemSettings>(res);
  },

  updateSettings: async (settings: SystemSettings): Promise<SystemSettings> => {
    const res = await fetch(`${API_BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    return handleResponse<SystemSettings>(res);
  }
};
