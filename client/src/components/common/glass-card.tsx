import { type ReactNode } from 'react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface GlassCardProps {
  children: ReactNode;
  className?: string;
  title?: ReactNode;
  headerRight?: ReactNode;
}

export function GlassCard({ children, className = '', title, headerRight }: GlassCardProps) {
  const showHeader = title || headerRight;

  return (
    <div
      className={cn(
        "bg-panel border border-border flex flex-col overflow-hidden relative",
        className
      )}
    >
      {showHeader && (
        <div className="px-2 py-1 border-b border-border bg-black flex items-center justify-between z-10 shrink-0">
          {title ? (
            <span className="text-[11px] font-bold text-accent tracking-widest uppercase font-mono">
              {title}
            </span>
          ) : (
            <span />
          )}
          {headerRight && <div className="flex items-center">{headerRight}</div>}
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-auto z-10 bg-bg">{children}</div>
    </div>
  );
}
