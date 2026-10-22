import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';
import { TallyLoader } from './TallyLoader';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows the Tally loader before the label and disables the button. */
  loading?: boolean;
}

// Solid or softly tinted fills only: no outlines.
const variantClasses: Record<Variant, string> = {
  primary: 'bg-accent text-accent-on hover:brightness-105 active:brightness-95',
  secondary: 'bg-ink/[0.07] text-ink hover:bg-ink/10 active:bg-ink/[0.14]',
  ghost: 'bg-transparent text-ink hover:bg-ink/5',
  danger: 'bg-danger text-accent-on hover:brightness-105 active:brightness-95'
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base'
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, disabled, className, children, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-control font-semibold transition-[transform,background-color,filter] duration-150',
        'active:scale-[0.97]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        'disabled:pointer-events-none disabled:opacity-50 disabled:active:scale-100',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {loading && (
        <TallyLoader size={26} tone={variant === 'primary' || variant === 'danger' ? 'onAccent' : 'default'} />
      )}
      {children}
    </button>
  )
);
Button.displayName = 'Button';
