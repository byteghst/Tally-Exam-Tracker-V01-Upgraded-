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
 *
 * Balanced glass: a tight two-layer drop shadow (soft contact + gentle
 * ambient) plus a 1px inner top highlight, instead of one big heavy shadow.
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ interactive, accented, className, ...props }, ref) => (
    <div
      ref={ref}
      className={clsx(
        'glass-edge relative rounded-card border border-border/60 bg-surface-raised/[var(--glass-alpha)] backdrop-blur-glass shadow-[0_1px_2px_rgb(0_0_0/0.04),0_10px_28px_-14px_rgb(0_0_0/0.22),inset_0_1px_0_rgb(255_255_255/var(--glass-hi-a))] transition-shadow duration-200',
        interactive && 'cursor-pointer transition-transform hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-14px_rgb(0_0_0/0.3)] active:scale-[0.99] active:translate-y-0',
        // Kept tight (short blur, tucked-in spread) on purpose: a wide glow
        // bleeds past the card's own edge into the margin above/below it,
        // making two adjacent cards look like they're merging even though
        // the real spacing between them is unchanged.
        accented && 'shadow-[0_1px_2px_rgb(0_0_0/0.04),0_6px_16px_-8px_rgb(var(--accent)/0.35)] ring-1 ring-accent/20',
        className
      )}
      {...props}
    />
  )
);
GlassCard.displayName = 'GlassCard';
