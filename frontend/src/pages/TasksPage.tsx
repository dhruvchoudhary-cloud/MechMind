import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Wrench,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Play,
  FileText,
  AlertTriangle,
  ExternalLink,
  Save,
  Cpu,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

import { api } from '../services/api';
import { MaintenanceTaskItem } from '../types';
import { StatusBadge } from '../components/StatusBadge';

export const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<MaintenanceTaskItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [selectedTask, setSelectedTask] = useState<MaintenanceTaskItem | null>(null);
  const [notesInput, setNotesInput] = useState<string>('');
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadTasks = async () => {
    try {
      const data = await api.fetchTasks();
      setTasks(data);
      if (data.length > 0) {
        if (!selectedTask || !data.some((t) => t.id === selectedTask.id)) {
          setSelectedTask(data[0]);
          setNotesInput(data[0].notes || '');
        } else {
          const updated = data.find((t) => t.id === selectedTask.id);
          if (updated) setSelectedTask(updated);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
    const interval = setInterval(loadTasks, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectTask = (task: MaintenanceTaskItem) => {
    setSelectedTask(task);
    setNotesInput(task.notes || '');
  };

  const handleUpdateStatus = async (taskId: number, newStatus: string) => {
    try {
      setActionLoading(true);
      await api.updateTask(taskId, { status: newStatus, notes: notesInput || undefined });
      setActionNotice(`Task #${taskId} transitioned to '${newStatus}'.`);
      setTimeout(() => setActionNotice(null), 4000);
      await loadTasks();
    } catch (err: any) {
      alert(`Error updating task: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!selectedTask) return;
    try {
      setActionLoading(true);
      await api.updateTask(selectedTask.id, { notes: notesInput });
      setActionNotice(`Inspection notes for Task #${selectedTask.id} saved.`);
      setTimeout(() => setActionNotice(null), 4000);
      await loadTasks();
    } catch (err: any) {
      alert(`Error saving notes: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.machine_code.toLowerCase().includes(search.toLowerCase()) ||
      t.description.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  const openCount = tasks.filter((t) => t.status === 'open').length;
  const inProgressCount = tasks.filter((t) => t.status === 'in_progress').length;
  const completedCount = tasks.filter((t) => t.status === 'completed').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 10. EDITORIAL HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#303030]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="natgeo-mark-sm" />
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#F4F4F4] uppercase font-mono">
              AUTONOMOUS MAINTENANCE WORKSPACE
            </h1>
          </div>
          <p className="text-xs text-[#A3A3A3] mt-1 font-mono">
            Automated work order dispatch, corrective field procedures, and execution audit history
          </p>
        </div>

        {/* Counter Strip */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="px-3 py-1 bg-[#111111] border border-[#FFD629] text-[#FFD629]">
            OPEN: <b>{openCount}</b>
          </div>
          <div className="px-3 py-1 bg-[#111111] border border-[#F5B942] text-[#F5B942]">
            IN PROGRESS: <b>{inProgressCount}</b>
          </div>
          <div className="px-3 py-1 bg-[#111111] border border-[#72C99A] text-[#72C99A]">
            COMPLETED: <b>{completedCount}</b>
          </div>
        </div>
      </div>

      {actionNotice && (
        <div className="p-3 bg-[#171717] border border-[#FFD629] text-[#FFD629] text-xs font-mono flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="p-4 bg-[#111111] border border-[#303030] flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#6E6E6E] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search task title or machine..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-[#171717] border border-[#303030] text-xs font-mono text-[#F4F4F4] placeholder-[#6E6E6E] focus:outline-none focus:border-[#FFD629] w-64"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-[#171717] border border-[#303030] px-2.5 py-1 text-xs font-mono">
            <Filter className="w-3.5 h-3.5 text-[#6E6E6E]" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-transparent text-[#A3A3A3] focus:outline-none text-xs font-mono uppercase"
            >
              <option value="all" className="bg-[#111111]">All Statuses</option>
              <option value="open" className="bg-[#111111]">Open Work Orders</option>
              <option value="in_progress" className="bg-[#111111]">In Progress</option>
              <option value="completed" className="bg-[#111111]">Completed</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-[#171717] border border-[#303030] px-2.5 py-1 text-xs font-mono">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-transparent text-[#A3A3A3] focus:outline-none text-xs font-mono uppercase"
            >
              <option value="all" className="bg-[#111111]">All Priorities</option>
              <option value="critical" className="bg-[#111111]">Critical</option>
              <option value="high" className="bg-[#111111]">High</option>
              <option value="medium" className="bg-[#111111]">Medium</option>
              <option value="low" className="bg-[#111111]">Low</option>
            </select>
          </div>
        </div>

        <div className="text-xs font-mono text-[#6E6E6E]">
          SHOWING {filteredTasks.length} OF {tasks.length} WORK ORDERS
        </div>
      </div>

      {/* Structured Master-Detail Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Tasks Feed List (5 cols) */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-widest text-[#6E6E6E] px-1 flex items-center justify-between">
            <span>DISPATCH QUEUE</span>
            <span>{filteredTasks.length} ORDERS</span>
          </div>

          <div className="space-y-3">
            {filteredTasks.length > 0 ? (
              filteredTasks.map((task) => {
                const isSelected = selectedTask?.id === task.id;
                return (
                  <div
                    key={task.id}
                    onClick={() => handleSelectTask(task)}
                    className={`p-4 bg-[#111111] border transition-all duration-150 cursor-pointer text-left relative ${
                      isSelected
                        ? 'border-[#FFD629] bg-[#171717] border-l-4'
                        : 'border-[#303030] hover:border-[#6E6E6E] hover:bg-[#141414]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 font-mono text-xs">
                          <span className={`font-bold ${isSelected ? 'text-[#FFD629]' : 'text-white'}`}>
                            TASK #{task.id}
                          </span>
                          <span className="text-[#6E6E6E]">/</span>
                          <span className="text-[#A3A3A3] font-semibold">{task.machine_code}</span>
                        </div>
                        <h4 className="font-bold text-sm text-[#F4F4F4] mt-1.5 leading-snug line-clamp-1">
                          {task.title}
                        </h4>
                      </div>

                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <StatusBadge status={task.priority} size="sm" />
                        <StatusBadge status={task.status} size="sm" />
                      </div>
                    </div>

                    <p className="text-xs text-[#A3A3A3] font-sans mt-2 line-clamp-2 leading-relaxed">
                      {task.description}
                    </p>

                    <div className="mt-3 pt-2.5 border-t border-[#303030] flex items-center justify-between text-[10px] font-mono text-[#6E6E6E]">
                      <span>DISPATCHED: {new Date(task.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {task.completed_at && (
                        <span className="text-[#72C99A]">COMPLETED</span>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-8 bg-[#111111] border border-[#303030] text-center font-mono">
                <CheckCircle2 className="w-8 h-8 text-[#72C99A] mx-auto mb-2" />
                <div className="text-xs font-bold text-white uppercase">No Work Orders In Queue</div>
                <div className="text-[10px] text-[#6E6E6E] mt-1">Autonomous maintenance system is idle.</div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Task Execution Dossier (7 cols) */}
        {selectedTask ? (
          <div className="lg:col-span-7 space-y-6">
            <div className="p-6 bg-[#111111] border border-[#303030] relative">
              <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#FFD629]" />

              {/* Dossier Header */}
              <div className="pb-5 border-b border-[#303030]">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 font-mono text-xs text-[#FFD629] mb-1">
                      <span className="natgeo-mark-sm" />
                      <span className="font-bold tracking-widest">WORK ORDER #{selectedTask.id}</span>
                      <span className="text-[#6E6E6E]">/</span>
                      <Link
                        to={`/machines/${selectedTask.machine_code}`}
                        className="text-[#F4F4F4] hover:text-[#FFD629] font-bold"
                      >
                        {selectedTask.machine_code} ({selectedTask.machine_name})
                      </Link>
                    </div>

                    <h2 className="text-xl sm:text-2xl font-black text-[#F4F4F4] tracking-tight uppercase font-mono mt-1">
                      {selectedTask.title}
                    </h2>

                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-mono text-[#A3A3A3]">
                      <span>DISPATCHED: <b className="text-[#F4F4F4]">{new Date(selectedTask.created_at).toLocaleString()}</b></span>
                      {selectedTask.completed_at && (
                        <>
                          <span>•</span>
                          <span className="text-[#72C99A]">COMPLETED: <b>{new Date(selectedTask.completed_at).toLocaleString()}</b></span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end gap-2 flex-shrink-0">
                    <StatusBadge status={selectedTask.priority} size="md" />
                    <StatusBadge status={selectedTask.status} size="md" />
                  </div>
                </div>

                {/* State Transition Actions */}
                <div className="mt-5 pt-4 border-t border-[#303030]/80 flex flex-wrap items-center gap-3 font-mono">
                  <span className="text-[10px] text-[#6E6E6E] uppercase tracking-wider">OPERATOR ACTION:</span>
                  {selectedTask.status === 'open' && (
                    <button
                      disabled={actionLoading}
                      onClick={() => handleUpdateStatus(selectedTask.id, 'in_progress')}
                      className="px-4 py-2 bg-[#FFD629] hover:bg-yellow-400 text-black text-xs font-bold uppercase tracking-wider transition-colors"
                    >
                      Accept & Start Task
                    </button>
                  )}
                  {selectedTask.status === 'in_progress' && (
                    <button
                      disabled={actionLoading}
                      onClick={() => handleUpdateStatus(selectedTask.id, 'completed')}
                      className="px-4 py-2 bg-[#72C99A] hover:bg-emerald-400 text-black text-xs font-bold uppercase tracking-wider transition-colors"
                    >
                      Verify & Complete Task
                    </button>
                  )}
                  {selectedTask.status === 'completed' && (
                    <span className="text-xs text-[#72C99A] font-semibold flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Work order marked completed. Incident resolved.
                    </span>
                  )}
                </div>
              </div>

              {/* Description & Observed Signals */}
              <div className="my-5 p-4 bg-[#171717] border border-[#303030]">
                <div className="text-[10px] font-mono text-[#6E6E6E] uppercase tracking-wider mb-1.5">
                  AUTONOMOUS INCIDENT DISPATCH REASONING
                </div>
                <p className="text-xs text-[#F4F4F4] font-mono whitespace-pre-line leading-relaxed">
                  {selectedTask.description}
                </p>
              </div>

              {/* Recommended Action Plan Checklist */}
              <div className="p-4 bg-[#0B0B0B] border border-[#303030] font-mono">
                <div className="text-[10px] text-[#FFD629] uppercase tracking-wider font-bold mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#FFD629]" />
                  <span>RECOMMENDED ACTION PLAN & PROCEDURES</span>
                </div>
                <div className="text-xs text-[#F4F4F4] whitespace-pre-line leading-relaxed font-sans">
                  {selectedTask.recommendation}
                </div>
              </div>

              {/* Field Inspection Notes */}
              <div className="mt-5 font-mono">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-[#6E6E6E] uppercase tracking-wider">
                    TECHNICIAN AUDIT & FIELD EXECUTION NOTES
                  </span>
                  <button
                    onClick={handleSaveNotes}
                    disabled={actionLoading}
                    className="flex items-center gap-1.5 text-xs text-[#FFD629] hover:underline"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Notes</span>
                  </button>
                </div>
                <textarea
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Record technician inspection findings, vibration re-test results, or part replacements..."
                  rows={4}
                  className="w-full p-3 bg-[#0B0B0B] border border-[#303030] text-xs font-mono text-[#F4F4F4] placeholder-[#6E6E6E] focus:outline-none focus:border-[#FFD629]"
                />
              </div>

              {/* Autonomous Lifecycle Activity Timeline */}
              <div className="mt-6 pt-5 border-t border-[#303030]/80">
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#6E6E6E] mb-3">
                  INCIDENT-TO-ACTION TRACEABILITY
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-3 bg-[#171717] border border-[#303030]">
                    <div className="text-[10px] text-[#FFD629] font-bold">STAGE 01</div>
                    <div className="text-white font-semibold mt-0.5">Anomaly Detected</div>
                    <div className="text-[10px] text-[#6E6E6E] mt-1">Dual rules & Isolation Forest flagged deviation</div>
                  </div>
                  <div className="p-3 bg-[#171717] border border-[#303030]">
                    <div className="text-[10px] text-[#F5B942] font-bold">STAGE 02</div>
                    <div className="text-white font-semibold mt-0.5">Incident Qualified</div>
                    <div className="text-[10px] text-[#6E6E6E] mt-1">Risk score &gt;= 30; deduplicated alert created</div>
                  </div>
                  <div className="p-3 bg-[#171717] border border-[#303030]">
                    <div className="text-[10px] text-[#72C99A] font-bold">STAGE 03</div>
                    <div className="text-white font-semibold mt-0.5">Work Order Dispatched</div>
                    <div className="text-[10px] text-[#6E6E6E] mt-1">Procedure checklist generated automatically</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};
