import { type SelectHTMLAttributes, forwardRef, useId } from 'react';
import { clsx } from 'clsx';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

/** Same editorial field as Input: label above, bare line below, accent on focus. */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className, id, children, ...props }, ref) => {
    const generatedId = useId();
    const selectId = id ?? props.name ?? generatedId;
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={selectId} className="eyebrow">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={clsx(
            'h-11 rounded-none border-0 border-b bg-transparent px-0 text-lg text-ink',
            'transition-[border-color,box-shadow] duration-200 focus-visible:outline-none',
            error
              ? 'border-danger focus-visible:shadow-[0_1px_0_0_rgb(var(--danger))]'
              : 'border-ink/25 focus-visible:border-accent focus-visible:shadow-[0_1px_0_0_rgb(var(--accent))]',
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
