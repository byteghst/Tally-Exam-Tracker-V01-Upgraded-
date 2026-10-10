import { clsx } from 'clsx';

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={clsx('h-1.5 w-full overflow-hidden rounded-full bg-ink/10', className)}>
      <div
        className="h-full rounded-full bg-accent transition-all duration-700"
        style={{ width: `${clamped}%` }}
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
      />
    </div>
  );
}

export function ProgressRing({
  value,
  size = 56,
  strokeWidth = 5,
  label
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          className="stroke-ink/10"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="stroke-accent transition-all duration-700"
          fill="none"
        />
      </svg>
      <span className="absolute font-numeric text-sm font-semibold tabular-nums text-ink">
        {label ?? `${Math.round(clamped)}%`}
      </span>
    </div>
  );
}
