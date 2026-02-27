import type { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  color?: string;
  className?: string;
}

export function Badge({ children, color, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${className}`}
      style={
        color
          ? { backgroundColor: `${color}22`, color }
          : undefined
      }
    >
      {children}
    </span>
  );
}
