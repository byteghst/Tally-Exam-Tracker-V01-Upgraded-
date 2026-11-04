import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { clsx } from 'clsx';
import { parseISODate } from '@/lib/dates';
import { EASE_OUT } from '@/lib/motion';
import type { DayPrayers, PrayerKey } from '@/lib/prayer/times';
import { lastDays, PRAYER_KEYS } from '@/store/prayerLogStore';

/** Light to dark: how strong the fill is for 1, 2, 3 and 4 prayers. A full day turns forest green and glows. */
const LEVEL_OPACITY = [0, 0.38, 0.55, 0.72, 0.88];

/** One period of the wave is exactly as wide as the bar, so sliding it by one bar width loops seamlessly. */
const WAVE_PATH = 'M0 3 Q5 0 10 3 T20 3 T30 3 T40 3 V6 H0 Z';

function WaterBar({ count, reduced }: { count: number; reduced: boolean }) {
  const full = count >= PRAYER_KEYS.length;
  const pct = Math.min(100, (count / PRAYER_KEYS.length) * 100);
  return (
    <div className="relative h-10 w-4">
      {full && (
        <motion.span
          aria-hidden
          className="absolute -inset-1.5 rounded-full bg-forest blur-md"
          initial={{ opacity: 0 }}
          animate={reduced ? { opacity: 0.5 } : { opacity: [0.35, 0.8, 0.35] }}
          transition={reduced ? { duration: 0.3 } : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <div className="relative h-full w-full overflow-hidden rounded-full bg-ink/10">
        <motion.div
          className={clsx('absolute inset-x-0 bottom-0', full ? 'text-forest' : 'text-accent')}
          style={{ opacity: full ? 1 : LEVEL_OPACITY[count] }}
          initial={{ height: 0 }}
          animate={{ height: `${pct}%` }}
          // a soft, slightly bouncy spring so the water sloshes as it rises
          transition={reduced ? { duration: 0.2 } : { type: 'spring', stiffness: 55, damping: 9, mass: 1.1 }}
        >
          <div className="absolute inset-0 bg-current" />
          {count > 0 && (
            <motion.svg
              aria-hidden
              viewBox="0 0 40 6"
              preserveAspectRatio="none"
              className="absolute left-0 top-[-4px] h-[5px] w-[200%] fill-current"
              animate={reduced ? undefined : { x: ['0%', '-50%'] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
            >
              <path d={WAVE_PATH} />
            </motion.svg>
          )}
        </motion.div>
      </div>
    </div>
  );
}

/**
 * The last seven days as water-filled bars. Tap a day to fill in or correct
 * its prayers, for example one you forgot to tick.
 */
export function PrayerWeekStrip({
  logDays,
  todayKey,
  day,
  onToggle
}: {
  logDays: Record<string, PrayerKey[]>;
  todayKey: string;
  day: DayPrayers;
  onToggle: (date: string, key: PrayerKey) => Promise<void>;
}) {
  const reduced = useReducedMotion() ?? false;
  const [selected, setSelected] = useState<string | null>(null);
  const week = lastDays(todayKey, 7);
  const selectedCount = selected ? (logDays[selected]?.length ?? 0) : 0;

  // today's prayers that have not started yet stay locked; earlier days are fully editable
  const locked = (date: string, start: Date): boolean => date === todayKey && start.getTime() > Date.now();

  return (
    <div>
      <div className="mt-5 flex items-end justify-between gap-2" aria-label="Prayers marked in the last seven days">
        {week.map((date) => {
          const count = logDays[date]?.length ?? 0;
          const isToday = date === todayKey;
          const isSelected = date === selected;
          const dateLabel = parseISODate(date).toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'short',
            day: 'numeric'
          });
          return (
            <button
              key={date}
              type="button"
              onClick={() => setSelected(isSelected ? null : date)}
              aria-pressed={isSelected}
              aria-label={`${dateLabel}: ${count} of 5 prayers. Tap to edit`}
              className="flex flex-1 flex-col items-center gap-1.5 rounded-control py-1 transition-colors active:bg-ink/[0.05]"
            >
              <WaterBar count={count} reduced={reduced} />
              <span
                className={clsx(
                  'text-[11px] font-semibold',
                  isSelected ? 'text-accent' : isToday ? 'text-ink' : 'text-ink-faint'
                )}
              >
                {parseISODate(date).toLocaleDateString('en-US', { weekday: 'narrow' })}
              </span>
              <span
                className={clsx('h-1 w-1 rounded-full transition-opacity', isSelected ? 'bg-accent opacity-100' : 'opacity-0')}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      <AnimatePresence initial={false} mode="wait">
        {selected ? (
          <motion.div
            key={selected}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: EASE_OUT }}
            className="mt-3 rounded-control bg-surface-raised p-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm font-semibold text-ink">
                {selected === todayKey
                  ? 'Today'
                  : parseISODate(selected).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </p>
              <p className="font-numeric text-xs tabular-nums text-ink-muted">{selectedCount}/5</p>
            </div>
            <ul className="mt-3 flex items-start justify-between gap-1">
              {day.windows.map((w) => {
                const prayed = (logDays[selected] ?? []).includes(w.key);
                const isLocked = locked(selected, w.start);
                return (
                  <li key={w.key} className="flex flex-1 flex-col items-center gap-1.5">
                    <button
                      type="button"
                      disabled={isLocked}
                      onClick={() => void onToggle(selected, w.key)}
                      aria-pressed={prayed}
                      aria-label={
                        isLocked
                          ? `${w.name} has not started yet`
                          : `Mark ${w.name} as ${prayed ? 'not prayed' : 'prayed'}`
                      }
                      className={clsx(
                        'flex h-9 w-9 items-center justify-center rounded-full transition-colors',
                        prayed ? 'bg-forest text-surface-raised' : 'bg-ink/10 text-transparent',
                        isLocked && 'cursor-not-allowed opacity-30'
                      )}
                    >
                      <Check size={16} strokeWidth={3} />
                    </button>
                    <span className="text-[11px] text-ink-muted">{w.name}</span>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        ) : (
          <motion.p
            key="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-3 text-center text-xs text-ink-faint"
          >
            Tap a day to fill in a prayer you forgot.
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
