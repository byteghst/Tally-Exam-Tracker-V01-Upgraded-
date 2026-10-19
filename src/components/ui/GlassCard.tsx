import { type HTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  interactive?: boolean;
  /** Marks the one or two cards per screen that should stand out: the card is
   *  filled with the soft accent tint instead of the usual raised surface. */
  accented?: boolean;
}

/**
 * Surface primitive. The name is historical (the app used to be glass); it is
 * kept so every screen that still imports it keeps working. It is now a soft,
 * borderless panel: a lighter fill than the page, rounded corners and a gentle
 * shadow. No outline, no blur.
 */
export const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(
  ({ interactive, accented, className, ...props }, ref) => (
    <div
      ref={ref}
      className={clsx(
        'relative rounded-card shadow-soft',
        accented ? 'bg-accent-soft' : 'bg-surface-raised',
        interactive &&
          'cursor-pointer transition-[box-shadow,transform] duration-200 hover:shadow-raise active:scale-[0.99]',
        className
      )}
      {...props}
    />
  )
);
GlassCard.displayName = 'GlassCard';
