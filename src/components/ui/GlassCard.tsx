import { type HTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  /** Adds a subtle accent-colored glow/top-edge — for the one or two cards
   *  per screen that should read as the "hero" (Exam Countdown, Focus Now). */
  accented?: boolean;
}

/**
 * The single glass-surface primitive used everywhere. Intensity/blur are
 * driven by CSS variables set from Settings, so this component never
 * hardcodes opacity values.
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ interactive, accented, className, ...props }, ref) => (
    <div
      ref={ref}
      className={clsx(
        'glass-edge relative rounded-card border border-border/60 bg-surface-raised/[var(--glass-alpha)] backdrop-blur-glass shadow-glass-lg transition-shadow duration-200',
        interactive && 'cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-[0_16px_36px_-12px_rgb(0_0_0/0.32)] active:scale-[0.99] active:translate-y-0',
        accented && 'shadow-[0_1px_2px_rgb(0_0_0/0.04),0_14px_38px_-12px_rgb(var(--accent)/0.4)] ring-1 ring-accent/20',
        className
      )}
      {...props}
    />
  )
);
GlassCard.displayName = 'GlassCard';
