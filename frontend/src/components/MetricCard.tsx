import React from 'react';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  variant?: 'default' | 'healthy' | 'warning' | 'critical' | 'info' | 'highlight';
  dominant?: boolean;
  trend?: {
    value: string;
    isPositive?: boolean;
  };
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  dominant = false,
  trend
}) => {
  const borderAccent = {
    default: 'hover:border-[#FFD629]/40',
    healthy: 'hover:border-[#72C99A]/50',
    warning: 'hover:border-[#F5B942]/50',
    critical: 'hover:border-[#FF554A]/60',
    info: 'hover:border-[#FFD629]/60',
    highlight: 'border-[#FFD629]/50 bg-[#171717]'
  }[variant];

  const valueColor = {
    default: 'text-[#F4F4F4]',
    healthy: 'text-[#72C99A]',
    warning: 'text-[#F5B942]',
    critical: 'text-[#FF554A]',
    info: 'text-[#FFD629]',
    highlight: 'text-[#FFD629]'
  }[variant];

  return (
    <div
      className={`relative p-5 bg-[#111111] border border-[#303030] transition-colors duration-200 ${borderAccent} ${
        dominant ? 'col-span-2' : ''
      }`}
    >
      {/* Editorial top accent line when active/highlighted */}
      {variant === 'highlight' && (
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-[#FFD629]" />
      )}

      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-mono tracking-widest text-[#A3A3A3] uppercase">
          {title}
        </span>
        {Icon && (
          <div className="text-[#6E6E6E] p-1">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-3">
        <div
          className={`font-mono font-bold tracking-tight ${
            dominant ? 'text-4xl text-white' : 'text-3xl'
          } ${valueColor}`}
        >
          {value}
        </div>
        {trend && (
          <span
            className={`text-xs font-mono font-medium ${
              trend.isPositive ? 'text-[#72C99A]' : 'text-[#FF554A]'
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>

      {subtitle && (
        <div className="mt-2 text-xs font-sans text-[#6E6E6E] tracking-normal">
          {subtitle}
        </div>
      )}
    </div>
  );
};
