import { type HTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  /** Marks the one or two cards per screen that should stand out: the border
   *  turns accent blue instead of adding any glow or shadow. */
  accented?: boolean;
}

/**
 * Flat surface primitive. The name is historical (the app used to be glass);
 * it is kept so every screen that still imports it keeps working while the
 * redesign rolls out screen by screen. It is now a plain bordered panel: no
 * blur, no translucency, no shadow.
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ interactive, accented, className, ...props }, ref) => (
    <div
      ref={ref}
      className={clsx(
        'relative rounded-card border bg-surface-raised',
        accented ? 'border-accent/40' : 'border-border',
        interactive &&
          'cursor-pointer transition-[border-color,transform] duration-200 hover:border-ink/30 active:scale-[0.995]',
        className
      )}
      {...props}
    />
  )
);
GlassCard.displayName = 'GlassCard';
