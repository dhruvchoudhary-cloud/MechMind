import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Cpu,
  AlertTriangle,
  Wrench,
  Settings,
  ChevronLeft,
  X,
  Radio,
  SlidersHorizontal
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  activeAlertCount?: number;
  openTaskCount?: number;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  onToggleCollapse,
  activeAlertCount = 0,
  openTaskCount = 0,
  mobileOpen = false,
  onCloseMobile
}) => {
  const navItems = [
    { to: '/', label: 'Overview', code: '01', icon: LayoutDashboard },
    { to: '/machines', label: 'Machines', code: '02', icon: Cpu },
    {
      to: '/alerts',
      label: 'Alerts',
      code: '03',
      icon: AlertTriangle,
      badge: activeAlertCount > 0 ? activeAlertCount : undefined,
      badgeColor: 'border-[#FF554A] text-[#FF554A] bg-[#FF554A]/10'
    },
    {
      to: '/tasks',
      label: 'Maintenance',
      code: '04',
      icon: Wrench,
      badge: openTaskCount > 0 ? openTaskCount : undefined,
      badgeColor: 'border-[#FFD629] text-[#FFD629] bg-[#FFD629]/10'
    },
    { to: '/settings', label: 'Settings', code: '05', icon: Settings },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-black/80 z-30 md:hidden backdrop-blur-sm transition-opacity"
        />
      )}

      <aside
        className={`fixed top-0 left-0 h-screen z-40 transition-all duration-300 ease-in-out border-r border-[#303030] bg-[#0B0B0B] flex flex-col ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${collapsed ? 'w-20' : 'w-64'}`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#303030]">
          {!collapsed ? (
            <div className="flex items-center gap-3 overflow-hidden">
              {/* Iconic National Geographic style Yellow Geometric Frame Mark */}
              <div className="natgeo-mark" />
              <div className="flex flex-col">
                <span className="font-black text-sm tracking-widest text-[#F4F4F4] font-mono uppercase leading-tight">
                  MechMind
                </span>
                <span className="text-[9px] text-[#A3A3A3] font-mono tracking-widest uppercase">
                  AUTONOMOUS INDUSTRIAL AI
                </span>
              </div>
            </div>
          ) : (
            <div className="w-full flex justify-center">
              <div className="natgeo-mark" />
            </div>
          )}

          {/* Desktop Collapse Button */}
          <button
            onClick={onToggleCollapse}
            className={`p-1.5 text-[#A3A3A3] hover:text-[#FFD629] hover:bg-[#171717] transition-colors hidden md:block ${
              collapsed ? 'hidden' : 'block'
            }`}
            title="Collapse Sidebar"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Mobile Close Button */}
          <button
            onClick={onCloseMobile}
            className="p-1.5 text-[#A3A3A3] hover:text-[#FFD629] hover:bg-[#171717] transition-colors md:hidden"
            title="Close Drawer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Technical Sub-Header / Status Rail */}
        <div
          className={`px-3 py-2.5 mx-3 mt-3 border border-[#303030] bg-[#111111] flex items-center gap-2.5 ${
            collapsed ? 'justify-center mx-2 px-1' : ''
          }`}
        >
          <div className="w-2 h-2 bg-[#FFD629] flex-shrink-0" />
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-[10px] font-mono tracking-widest text-[#F4F4F4] uppercase font-semibold">
                SURVEILLANCE ACTIVE
              </span>
              <span className="text-[9px] text-[#6E6E6E] font-mono">
                REAL-TIME TELEMETRY STREAM
              </span>
            </div>
          )}
        </div>

        {/* Navigation Section */}
        <div className="px-4 pt-4 pb-1">
          {!collapsed && (
            <span className="text-[10px] font-mono uppercase tracking-widest text-[#6E6E6E]">
              SYSTEM INDEX
            </span>
          )}
        </div>

        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3 py-2.5 text-xs font-mono tracking-wider transition-all duration-150 ${
                  isActive
                    ? 'bg-[#171717] text-[#F4F4F4] font-semibold border-l-2 border-[#FFD629]'
                    : 'text-[#A3A3A3] hover:text-[#F4F4F4] hover:bg-[#111111] border-l-2 border-transparent'
                } ${collapsed ? 'justify-center px-2' : ''}`
              }
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="w-4 h-4 flex-shrink-0 text-[#A3A3A3] group-hover:text-[#FFD629] transition-colors" />
              {!collapsed && (
                <div className="flex-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[#6E6E6E] font-mono">{item.code}</span>
                    <span className="uppercase">{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 border font-mono font-bold ${item.badgeColor}`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Editorial Footer Specs */}
        <div className="p-3.5 border-t border-[#303030] bg-[#050505] font-mono text-[10px]">
          {!collapsed ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[#6E6E6E] uppercase">INTELLIGENCE</span>
                <span className="text-[#FFD629]">ISOLATION FOREST</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#6E6E6E] uppercase">RULE ENGINE</span>
                <span className="text-[#72C99A]">ISO 10816 + THERMAL</span>
              </div>
              <div className="flex items-center justify-between pt-1 border-t border-[#303030]/60 text-[#6E6E6E]">
                <span>RELEASE</span>
                <span className="text-[#A3A3A3]">v2.0 EDITORIAL</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center text-[#FFD629] font-mono font-bold text-[10px]">
              AI
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
