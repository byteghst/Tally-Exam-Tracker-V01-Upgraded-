import { type ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

// Flat: solid fills and hairline outlines only, no shadows or glows.
const variantClasses: Record<Variant, string> = {
  primary: 'bg-accent text-accent-on hover:brightness-105 active:brightness-95',
  secondary: 'border border-ink/20 bg-transparent text-ink hover:bg-ink/5',
  ghost: 'bg-transparent text-ink hover:bg-ink/5',
  danger: 'bg-danger text-accent-on hover:brightness-105 active:brightness-95'
};

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base'
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className, ...props }, ref) => (
    <button
      ref={ref}
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
    />
  )
);
Button.displayName = 'Button';
