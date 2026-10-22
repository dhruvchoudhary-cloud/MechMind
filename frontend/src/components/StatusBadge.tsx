import React from 'react';
import { RiskLevel, AlertStatus, TaskStatus } from '../types';

interface StatusBadgeProps {
  status: RiskLevel | AlertStatus | TaskStatus | string;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md', showDot = true }) => {
  const normalized = status.toLowerCase();

  let bg = 'bg-[#171717] text-[#A3A3A3] border-[#303030]';
  let dotBg = 'bg-[#6E6E6E]';

  if (['healthy', 'low', 'completed', 'resolved', 'normal'].includes(normalized)) {
    bg = 'bg-[#72C99A]/10 text-[#72C99A] border-[#72C99A]/30';
    dotBg = 'bg-[#72C99A]';
  } else if (['warning', 'medium', 'acknowledged', 'in_progress', 'overheating'].includes(normalized)) {
    bg = 'bg-[#F5B942]/10 text-[#F5B942] border-[#F5B942]/30';
    dotBg = 'bg-[#F5B942]';
  } else if (['critical', 'high', 'combined_fault', 'excessive_vibration'].includes(normalized)) {
    bg = 'bg-[#FF554A]/10 text-[#FF554A] border-[#FF554A]/30';
    dotBg = 'bg-[#FF554A]';
  } else if (['active'].includes(normalized)) {
    bg = 'bg-[#FF554A]/15 text-[#FF554A] border-[#FF554A]/40';
    dotBg = 'bg-[#FF554A]';
  } else if (['open'].includes(normalized)) {
    bg = 'bg-[#FFD629]/10 text-[#FFD629] border-[#FFD629]/30';
    dotBg = 'bg-[#FFD629]';
  }

  const sizeClasses = {
    sm: 'text-[10px] px-2 py-0.5 tracking-wider',
    md: 'text-[11px] px-2.5 py-1 tracking-widest',
    lg: 'text-xs px-3 py-1.5 tracking-widest'
  }[size];

  const label = status.replace(/_/g, ' ').toUpperCase();

  return (
    <span className={`inline-flex items-center gap-1.5 font-mono uppercase font-semibold border ${bg} ${sizeClasses}`}>
      {showDot && <span className={`w-1.5 h-1.5 ${dotBg} flex-shrink-0`} />}
      {label}
    </span>
  );
};
