import { clsx } from 'clsx';
import { useNow } from '@/hooks/useNow';
import { formatCompact, remainingParts } from '@/lib/countdown';

interface LiveCountdownProps {
  /** The moment being counted down to, in ms (see `targetTime`). */
  target: number;
  /** `inline` = one short line of text; `block` = big tiles for days, hours, minutes, seconds. */
  variant?: 'inline' | 'block';
  /** Block only: the headline shown once the moment has passed. */
  pastLabel?: string;
  /** Inline only: text after the time left, e.g. "2d 04h 11m left". */
  futureSuffix?: string;
  /** Inline only: text before the time since, e.g. "Overdue 3h 10m". */
  pastPrefix?: string;
  /** Text after the time since, e.g. "Started 12m 09s ago". */
  pastSuffix?: string;
  className?: string;
}

function Tile({ value, label, hot }: { value: string; label: string; hot?: boolean }) {
  return (
    <div className="flex flex-1 flex-col items-center rounded-control bg-ink/[0.05] px-1 py-3">
      <span
        className={clsx(
          'font-numeric text-3xl font-semibold leading-none tabular-nums',
          hot ? 'text-accent' : 'text-ink'
        )}
      >
        {value}
      </span>
      <span className="eyebrow mt-1.5 !text-[0.6rem]">{label}</span>
    </div>
  );
}

/**
 * A live countdown that ticks every second. Counts down to `target`, and once
 * that moment has passed counts up from it, so "Overdue" and "Started" states
 * stay accurate too.
 */
export function LiveCountdown({
  target,
  variant = 'inline',
  pastLabel = 'Time is up',
  futureSuffix = ' left',
  pastPrefix = 'Overdue',
  pastSuffix = '',
  className
}: LiveCountdownProps) {
  const now = useNow();
  const r = remainingParts(target, now);
  const pad = (n: number) => String(n).padStart(2, '0');

  if (variant === 'inline') {
    return (
      <span className={clsx('tabular-nums', className)}>
        {r.past ? `${pastPrefix} ${formatCompact(r)}${pastSuffix}` : `${formatCompact(r)}${futureSuffix}`}
      </span>
    );
  }

  if (r.past) {
    return (
      <div role="timer" className={clsx('rounded-control bg-danger/10 px-4 py-3', className)}>
        <p className="font-serif text-3xl leading-none text-danger">{pastLabel}</p>
        <p className="mt-2 font-numeric text-sm tabular-nums text-ink-muted">
          {formatCompact(r)}
          {pastSuffix}
        </p>
      </div>
    );
  }

  // Under an hour left: the numbers turn persimmon so it reads as urgent.
  const urgent = r.days === 0 && r.hours === 0;

  return (
    <div role="timer" aria-live="off" className={clsx('flex gap-2', className)}>
      {r.days > 0 && <Tile value={String(r.days)} label="Days" />}
      <Tile value={pad(r.hours)} label="Hours" hot={urgent} />
      <Tile value={pad(r.minutes)} label="Min" hot={urgent} />
      <Tile value={pad(r.seconds)} label="Sec" hot />
    </div>
  );
}
