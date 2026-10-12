import { type TextareaHTMLAttributes, forwardRef, useId } from 'react';
import { clsx } from 'clsx';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

/** Multi-line version of the editorial field. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, className, id, rows = 2, ...props }, ref) => {
    const generatedId = useId();
    const textareaId = id ?? props.name ?? generatedId;
    return (
      <div className="flex flex-col gap-1">
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
            'w-full resize-none rounded-none border-0 border-b bg-transparent px-0 py-2 text-lg text-ink placeholder:text-ink-faint/70',
            'transition-[border-color,box-shadow] duration-200 focus-visible:outline-none',
            error
              ? 'border-danger focus-visible:shadow-[0_1px_0_0_rgb(var(--danger))]'
              : 'border-ink/25 focus-visible:border-accent focus-visible:shadow-[0_1px_0_0_rgb(var(--accent))]',
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
