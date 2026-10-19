import { type InputHTMLAttributes, forwardRef, useId } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

/**
 * Soft filled field: a small spaced label above a tinted, rounded box. No
 * outline; focus brightens the fill and adds a soft persimmon glow ring.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? props.name ?? generatedId;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="eyebrow">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'h-12 rounded-control border-0 bg-ink/[0.05] px-4 text-base text-ink placeholder:text-ink-faint/70',
            'transition-[background-color,box-shadow] duration-200 focus-visible:bg-ink/[0.07] focus-visible:outline-none focus-visible:ring-2',
            error ? 'ring-2 ring-danger/60 focus-visible:ring-danger' : 'focus-visible:ring-accent/50',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : undefined}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';
