import { type ReactNode } from 'react';
import { clsx } from 'clsx';
import type { LucideIcon } from 'lucide-react';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

const toneClasses: Record<Tone, string> = {
  neutral: 'bg-ink/5 text-ink-muted',
  success: 'bg-success/15 text-success',
  warning: 'bg-warning/15 text-warning',
  danger: 'bg-danger/15 text-danger',
  accent: 'bg-accent/15 text-accent'
};

export function Badge({
  tone = 'neutral',
  className,
  children
}: {
  tone?: Tone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        toneClasses[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon: Icon
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-border px-6 py-12 text-center">
      {Icon && (
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Icon size={22} strokeWidth={1.75} />
        </div>
      )}
      <p className="font-serif text-2xl text-ink">{title}</p>
      <p className="max-w-xs text-sm text-ink-muted">{description}</p>
      {action}
    </div>
  );
}
