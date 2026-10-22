import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Wrench,
  ExternalLink,
  RotateCcw,
  Cpu
} from 'lucide-react';

import { api } from '../services/api';
import { AlertItem } from '../types';
import { StatusBadge } from '../components/StatusBadge';

export const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const loadAlerts = async () => {
    try {
      const data = await api.fetchAlerts();
      setAlerts(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdateStatus = async (alertId: number, status: 'acknowledged' | 'resolved') => {
    try {
      setActionLoadingId(alertId);
      await api.updateAlertStatus(alertId, status);
      setActionNotice(`Alert #${alertId} updated to '${status}'.`);
      setTimeout(() => setActionNotice(null), 4000);
      await loadAlerts();
    } catch (err: any) {
      alert(`Error updating alert: ${err.message}`);
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredAlerts = alerts.filter((a) => {
    const matchesSearch =
      a.machine_code.toLowerCase().includes(search.toLowerCase()) ||
      a.machine_name.toLowerCase().includes(search.toLowerCase()) ||
      a.description.toLowerCase().includes(search.toLowerCase()) ||
      a.alert_type.toLowerCase().includes(search.toLowerCase());

    const matchesStatus = statusFilter === 'all' || a.status === statusFilter;
    const matchesSeverity = severityFilter === 'all' || a.severity === severityFilter;

    return matchesSearch && matchesStatus && matchesSeverity;
  });

  const activeCount = alerts.filter((a) => a.status === 'active').length;
  const acknowledgedCount = alerts.filter((a) => a.status === 'acknowledged').length;
  const resolvedCount = alerts.filter((a) => a.status === 'resolved').length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 9. EDITORIAL HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#303030]">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="natgeo-mark-sm" />
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-[#F4F4F4] uppercase font-mono">
              INCIDENT INTELLIGENCE FEED
            </h1>
          </div>
          <p className="text-xs text-[#A3A3A3] mt-1 font-mono">
            Autonomous mechanical alerts, severity triage, and deduplicated incident lifecycle management
          </p>
        </div>

        {/* Counter Strip */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="px-3 py-1 bg-[#111111] border border-[#FF554A] text-[#FF554A]">
            ACTIVE: <b>{activeCount}</b>
          </div>
          <div className="px-3 py-1 bg-[#111111] border border-[#F5B942] text-[#F5B942]">
            ACKNOWLEDGED: <b>{acknowledgedCount}</b>
          </div>
          <div className="px-3 py-1 bg-[#111111] border border-[#72C99A] text-[#72C99A]">
            RESOLVED: <b>{resolvedCount}</b>
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
              placeholder="Search alert, machine code, or fault..."
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
              <option value="active" className="bg-[#111111]">Active Only</option>
              <option value="acknowledged" className="bg-[#111111]">Acknowledged</option>
              <option value="resolved" className="bg-[#111111]">Resolved</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5 bg-[#171717] border border-[#303030] px-2.5 py-1 text-xs font-mono">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-transparent text-[#A3A3A3] focus:outline-none text-xs font-mono uppercase"
            >
              <option value="all" className="bg-[#111111]">All Severities</option>
              <option value="critical" className="bg-[#111111]">Critical</option>
              <option value="high" className="bg-[#111111]">High</option>
              <option value="medium" className="bg-[#111111]">Medium</option>
              <option value="low" className="bg-[#111111]">Low</option>
            </select>
          </div>
        </div>

        <div className="text-xs font-mono text-[#6E6E6E]">
          SHOWING {filteredAlerts.length} OF {alerts.length} INCIDENTS
        </div>
      </div>

      {/* 9. EDITORIAL ARTICLE LIST OF INCIDENTS */}
      <div className="bg-[#111111] border border-[#303030] divide-y divide-[#303030]">
        {filteredAlerts.length > 0 ? (
          filteredAlerts.map((alert) => {
            const isCritical = alert.severity === 'critical' || alert.severity === 'high';
            const isWarning = alert.severity === 'medium';
            const markerColor = isCritical ? 'border-l-4 border-l-[#FF554A]' : isWarning ? 'border-l-4 border-l-[#F5B942]' : 'border-l-4 border-l-[#72C99A]';

            return (
              <article
                key={alert.id}
                className={`p-5 hover:bg-[#171717] transition-colors relative ${markerColor}`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  {/* Left Metadata & Title */}
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
                      <span className="text-[#FFD629] font-bold tracking-wider">
                        INCIDENT #{alert.id}
                      </span>
                      <span className="text-[#6E6E6E]">/</span>
                      <Link
                        to={`/machines/${alert.machine_code}`}
                        className="text-[#F4F4F4] hover:text-[#FFD629] font-semibold flex items-center gap-1"
                      >
                        <Cpu className="w-3.5 h-3.5 text-[#6E6E6E]" />
                        <span>{alert.machine_code}</span>
                        <span className="text-[#6E6E6E]">({alert.machine_name})</span>
                      </Link>
                      <span className="text-[#6E6E6E]">/</span>
                      <StatusBadge status={alert.severity} size="sm" />
                      <StatusBadge status={alert.status} size="sm" />
                    </div>

                    <h3 className="text-base font-bold text-[#F4F4F4] font-mono tracking-tight">
                      {alert.alert_type.replace(/_/g, ' ')}
                    </h3>

                    <p className="text-xs text-[#A3A3A3] font-sans leading-relaxed max-w-4xl">
                      {alert.description}
                    </p>

                    {/* Sensor snapshot & Timestamp strip */}
                    <div className="flex flex-wrap items-center gap-4 pt-2 text-[11px] font-mono text-[#6E6E6E]">
                      <span className="flex items-center gap-1.5 text-[#A3A3A3]">
                        <Clock className="w-3 h-3 text-[#6E6E6E]" />
                        FIRST OBSERVED: {new Date(alert.first_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span>•</span>
                      <span className="text-[#A3A3A3]">
                        LAST OBSERVED: {new Date(alert.last_seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span>•</span>
                      <span className="text-[#FFD629]">
                        STATUS: {alert.status.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {/* Right Actions & Task Links */}
                  <div className="flex flex-col sm:flex-row lg:flex-col items-start lg:items-end gap-2.5 flex-shrink-0 font-mono">
                    <Link
                      to="/tasks"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#171717] hover:bg-[#202020] text-[#FFD629] border border-[#303030] text-xs font-semibold uppercase tracking-wider transition-colors"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>Linked Task</span>
                      <ExternalLink className="w-3 h-3 text-[#6E6E6E]" />
                    </Link>

                    <div className="flex items-center gap-2">
                      {alert.status === 'active' && (
                        <button
                          disabled={actionLoadingId === alert.id}
                          onClick={() => handleUpdateStatus(alert.id, 'acknowledged')}
                          className="px-3 py-1.5 bg-[#171717] hover:bg-[#222222] text-[#F5B942] border border-[#F5B942]/60 text-xs font-bold uppercase tracking-wider transition-colors"
                        >
                          Acknowledge
                        </button>
                      )}
                      {alert.status !== 'resolved' && (
                        <button
                          disabled={actionLoadingId === alert.id}
                          onClick={() => handleUpdateStatus(alert.id, 'resolved')}
                          className="px-3 py-1.5 bg-[#171717] hover:bg-[#222222] text-[#72C99A] border border-[#72C99A]/60 text-xs font-bold uppercase tracking-wider transition-colors"
                        >
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <div className="p-12 text-center font-mono">
            <CheckCircle2 className="w-8 h-8 text-[#72C99A] mx-auto mb-2" />
            <h4 className="text-sm font-bold text-white uppercase">Zero Incidents in Filter</h4>
            <p className="text-xs text-[#6E6E6E] mt-1">
              No anomalies matching the specified criteria. Monitored assets within operating envelope.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
