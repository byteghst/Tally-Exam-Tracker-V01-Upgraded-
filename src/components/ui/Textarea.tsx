import { type TextareaHTMLAttributes, forwardRef, useId } from 'react';
import { clsx } from 'clsx';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

/** Multi-line version of the soft filled field. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, rows = 2, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id ?? props.name ?? generatedId;
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={textareaId} className="eyebrow">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={clsx(
            'w-full resize-none rounded-control border-0 bg-ink/[0.05] px-4 py-3 text-base text-ink placeholder:text-ink-faint/70',
            'transition-[background-color,box-shadow] duration-200 focus-visible:bg-ink/[0.07] focus-visible:outline-none focus-visible:ring-2',
            error ? 'ring-2 ring-danger/60 focus-visible:ring-danger' : 'focus-visible:ring-accent/50',
            className
          )}
          aria-invalid={!!error}
          {...props}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
