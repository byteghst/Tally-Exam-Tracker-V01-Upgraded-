import { type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { EASE_OUT, springBouncy } from '@/lib/motion';

/** Circle with a tick that draws itself when `checked` becomes true. */
export function AnimatedCheck({ checked, size = 20, className }: { checked: boolean; size?: number; className?: string }) {
  return (
    <span
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-full border transition-colors duration-300',
        checked ? 'border-ink bg-ink' : 'border-ink-faint/60',
        className
      )}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size * 0.62}
        height={size * 0.62}
        fill="none"
        className="stroke-surface"
        strokeWidth={3.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <motion.path
          d="M5 12.5l4.5 4.5L19 7.5"
          initial={false}
          animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
          transition={{ duration: 0.35, ease: EASE_OUT }}
        />
      </svg>
    </span>
  );
}

/** Tappable checkbox: squishes on press, then the tick draws in. */
export function CheckButton({
  checked,
  onToggle,
  label
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      whileTap={{ scale: 0.8 }}
      transition={springBouncy}
      className="-m-1.5 shrink-0 rounded-full p-1.5"
    >
      <AnimatedCheck checked={checked} size={22} />
    </motion.button>
  );
}

/** Text with a strike-through line that sweeps across when `done` becomes true. */
export function StrikeText({ done, children, className }: { done: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={clsx('relative transition-colors duration-300', done ? 'text-ink-faint' : 'text-ink', className)}>
      {children}
      <motion.span
        aria-hidden
        className="absolute left-0 top-1/2 h-px bg-ink-faint"
        initial={false}
        animate={{ width: done ? '100%' : '0%' }}
        transition={{ duration: 0.4, ease: EASE_OUT }}
      />
    </span>
  );
}
