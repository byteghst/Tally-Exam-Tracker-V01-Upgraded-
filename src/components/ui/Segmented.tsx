import { useId } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { spring } from '@/lib/motion';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** Tailwind background class for this option's selected state (defaults to ink). */
  color?: string;
  disabled?: boolean;
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  className?: string;
}

/**
 * Choose one of a few options. The filled highlight slides from the old choice
 * to the new one.
 */
export function Segmented<T extends string>({ options, value, onChange, label, className }: SegmentedProps<T>) {
  const groupId = useId();
  return (
    <div className="flex flex-col gap-2" role="group" aria-label={label}>
      {label && <p className="eyebrow">{label}</p>}
      <div className={clsx('flex gap-1 rounded-control border border-ink/20 p-1', className)}>
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={option.disabled}
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              className={clsx(
                'relative flex-1 rounded-[7px] px-3 py-2 text-sm font-semibold capitalize transition-colors duration-200',
                'disabled:pointer-events-none disabled:opacity-35',
                active ? (option.color ? 'text-accent-on' : 'text-surface') : 'text-ink-muted hover:text-ink'
              )}
            >
              {active && (
                <motion.span
                  layoutId={groupId}
                  transition={spring}
                  className={clsx('absolute inset-0 rounded-[7px]', option.color ?? 'bg-ink')}
                />
              )}
              <span className="relative">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
