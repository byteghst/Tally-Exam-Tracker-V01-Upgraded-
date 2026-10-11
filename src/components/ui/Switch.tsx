import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { springBouncy } from '@/lib/motion';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

/** Flat on/off switch: the knob springs across and the track turns persimmon. */
export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-300',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        checked ? 'bg-accent' : 'bg-ink/15'
      )}
    >
      <motion.span
        aria-hidden
        className="absolute left-1 top-1 h-5 w-5 rounded-full bg-surface-raised"
        initial={false}
        animate={{ x: checked ? 20 : 0 }}
        transition={springBouncy}
      />
    </button>
  );
}

/** A labelled row with a switch on the right. */
export function ToggleRow({
  label,
  hint,
  checked,
  onChange
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-base text-ink">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-faint">{hint}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
