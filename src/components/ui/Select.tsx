import { type SelectHTMLAttributes, forwardRef, useId } from 'react';
import { clsx } from 'clsx';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

/** Same soft filled field as Input: label above, tinted rounded box below. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className, id, children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? props.name ?? generatedId;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={selectId} className="eyebrow">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={clsx(
            'h-12 rounded-control border-0 bg-ink/[0.05] px-3 text-base text-ink',
            'transition-[background-color,box-shadow] duration-200 focus-visible:bg-ink/[0.07] focus-visible:outline-none focus-visible:ring-2',
            error ? 'ring-2 ring-danger/60 focus-visible:ring-danger' : 'focus-visible:ring-accent/50',
            className
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${selectId}-error` : undefined}
          {...props}
        >
          {children}
        </select>
        {error && (
          <p id={`${selectId}-error`} className="text-sm text-danger">
            {error}
          </p>
        )}
      </div>
    );
  }
);
Select.displayName = 'Select';
