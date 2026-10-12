import { type InputHTMLAttributes, forwardRef, useId } from 'react';
import { clsx } from 'clsx';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

/**
 * Editorial field: a small spaced label above a bare line. No box. The line
 * turns persimmon (and doubles in weight) when the field is focused.
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const generatedId = useId();
    const inputId = id ?? props.name ?? generatedId;
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="eyebrow">
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={clsx(
            'h-11 rounded-none border-0 border-b bg-transparent px-0 text-lg text-ink placeholder:text-ink-faint/70',
            'transition-[border-color,box-shadow] duration-200 focus-visible:outline-none',
            error
              ? 'border-danger focus-visible:shadow-[0_1px_0_0_rgb(var(--danger))]'
              : 'border-ink/25 focus-visible:border-accent focus-visible:shadow-[0_1px_0_0_rgb(var(--accent))]',
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
