import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ChevronDown } from 'lucide-react';
import { clsx } from 'clsx';
import { EASE_OUT } from '@/lib/motion';
import { BD_CITIES, findCity, type BdCity } from '@/lib/prayer/cities';
import {
  computeDay,
  formatClock,
  formatDuration,
  type DayPrayers,
  type PrayerKey,
  type PrayerWindow,
  type ProhibitedWindow
} from '@/lib/prayer/times';
import { usePrayerStore } from '@/store/prayerStore';

const SELECT_CLASS =
  'mt-3 w-full rounded-control border border-border bg-surface px-3 py-2.5 text-base text-ink';

/** Everything the button and the popup need, worked out once per tick. */
interface PrayerView {
  now: number;
  city: BdCity;
  day: DayPrayers;
  activeKey: PrayerKey | null;
  activeWin: PrayerWindow | null;
  nextWin: PrayerWindow | null;
  progress: number;
  prohibitedNow: ProhibitedWindow | null;
}

function usePrayerView(): PrayerView {
  const cityName = usePrayerStore((s) => s.cityName);

  // re-check twice a minute so the countdown and highlight stay current
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const city = findCity(cityName);
  const day = computeDay(new Date(now), city.lat, city.lng);

  // Which prayer is running? Between midnight and Fajr it is still last night's Isha.
  let activeKey: PrayerKey | null = null;
  let activeWin: PrayerWindow | null = null;
  if (now < day.windows[0].start.getTime()) {
    activeKey = 'isha';
    activeWin = { ...day.windows[4], start: day.prevIshaStart, end: day.windows[0].start };
  } else {
    const found = day.windows.find((w) => now >= w.start.getTime() && now < w.end.getTime());
    if (found) {
      activeKey = found.key;
      activeWin = found;
    }
  }
  // between sunrise and Dhuhr (and the minutes between sunset and Maghrib) no
  // prayer is running: show what comes next
  const nextWin = activeWin ? null : (day.windows.find((w) => w.start.getTime() > now) ?? null);

  const progress = activeWin
    ? Math.max(0, Math.min(1, (now - activeWin.start.getTime()) / (activeWin.end.getTime() - activeWin.start.getTime())))
    : 0;

  const prohibitedNow = day.prohibited.find((p) => now >= p.start.getTime() && now < p.end.getTime()) ?? null;

  return { now, city, day, activeKey, activeWin, nextWin, progress, prohibitedNow };
}

/**
 * A small floating button on the dashboard that always shows the prayer that
 * is running now, with a softly pulsing light (red during a prohibited time).
 * Tapping it opens the full prayer times in a popup that grows out of the
 * button; the Back button (or Escape, or a tap outside) closes it again.
 *
 * It is drawn into document.body so it floats above everything and is not
 * tied to the page's layout or animations.
 */
export function PrayerFab() {
  const view = usePrayerView();
  const [open, setOpen] = useState(false);

  const label = view.activeWin ? view.activeWin.name : view.nextWin ? `Next · ${view.nextWin.name}` : 'Prayer';
  const sub = view.activeWin
    ? `${formatDuration(view.activeWin.end.getTime() - view.now)} left`
    : view.nextWin
      ? `in ${formatDuration(view.nextWin.start.getTime() - view.now)}`
      : '';
  const danger = view.prohibitedNow !== null;

  return createPortal(
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Prayer times. ${label}${sub ? `, ${sub}` : ''}${danger ? '. Prohibited time now' : ''}`}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: open ? 0 : 1, scale: open ? 0.85 : 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 6rem)', pointerEvents: open ? 'none' : 'auto' }}
        className="fixed right-4 z-40 flex items-center gap-3 rounded-full bg-ink py-3 pl-4 pr-5 text-surface shadow-lg md:bottom-8 md:right-8"
      >
        <span className="relative flex h-2.5 w-2.5" aria-hidden>
          <span
            className={clsx(
              'absolute inline-flex h-full w-full animate-ping rounded-full opacity-70',
              danger ? 'bg-danger' : 'bg-accent'
            )}
          />
          <span className={clsx('relative inline-flex h-2.5 w-2.5 rounded-full', danger ? 'bg-danger' : 'bg-accent')} />
        </span>
        <span className="text-left leading-tight">
          <span className="block text-sm font-semibold">{label}</span>
          {sub && <span className="block font-numeric text-[11px] tabular-nums opacity-70">{sub}</span>}
        </span>
      </motion.button>

      <AnimatePresence>{open && <PrayerOverlay view={view} onClose={() => setOpen(false)} />}</AnimatePresence>
    </>,
    document.body
  );
}

/** One block of the popup, fading up a moment after the one before it. */
function Block({ index, className, children }: { index: number; className?: string; children: React.ReactNode }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.12 + index * 0.06, duration: 0.45, ease: EASE_OUT }}
    >
      {children}
    </motion.div>
  );
}

function PrayerOverlay({ view, onClose }: { view: PrayerView; onClose: () => void }) {
  const cityName = usePrayerStore((s) => s.cityName);
  const setCity = usePrayerStore((s) => s.setCity);
  const [changingCity, setChangingCity] = useState(false);
  const { now, city, day, activeKey, activeWin, nextWin, progress, prohibitedNow } = view;

  // Escape closes it, and the page behind does not scroll while it is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  function statusOf(w: PrayerWindow): 'active' | 'past' | 'upcoming' {
    if (w.key === activeKey) return 'active';
    return w.end.getTime() <= now ? 'past' : 'upcoming';
  }

  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center"
      style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} aria-hidden />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Prayer times"
        className="relative max-h-[86dvh] w-full max-w-md overflow-y-auto rounded-3xl border border-border bg-surface p-6 shadow-2xl"
        // grows out of the floating button (bottom right) and shrinks back into it
        style={{ transformOrigin: '100% 100%' }}
        initial={{ opacity: 0, scale: 0.45, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.55, y: 30, transition: { duration: 0.24, ease: EASE_OUT } }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      >
        <Block index={0} className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            aria-label="Back"
            className="-ml-2 flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm text-ink-muted hover:bg-ink/5 hover:text-ink"
          >
            <ArrowLeft size={18} />
            Back
          </button>
          <button
            type="button"
            onClick={() => setChangingCity((v) => !v)}
            aria-expanded={changingCity}
            aria-label={`Prayer times for ${city.name}. Change district`}
            className="flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-accent"
          >
            {city.name}
            <ChevronDown size={14} className={clsx('transition-transform duration-300', changingCity && 'rotate-180')} />
          </button>
        </Block>

        {changingCity && (
          <select
            aria-label="District"
            value={cityName}
            onChange={(e) => setCity(e.target.value)}
            className={SELECT_CLASS}
          >
            {BD_CITIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        {prohibitedNow && (
          <Block index={1} className="mt-6">
            <div role="alert" className="border-l-2 border-danger bg-danger/5 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-danger">Prohibited time now</p>
              <p className="mt-1 text-sm text-ink">{prohibitedNow.detail}</p>
              <p className="mt-1 text-sm text-ink-muted">
                Until{' '}
                <span className="font-numeric tabular-nums text-ink">{formatClock(prohibitedNow.end)}</span> ·{' '}
                <span className="font-numeric tabular-nums">{formatDuration(prohibitedNow.end.getTime() - now)}</span>{' '}
                left
              </p>
            </div>
          </Block>
        )}

        <Block index={2} className="mt-8">
          {activeWin ? (
            <>
              <p className="eyebrow">Now</p>
              <p className="mt-2 font-serif text-6xl leading-none tracking-tight text-ink">{activeWin.name}</p>
              <p className="mt-3 text-sm text-ink-muted">
                <span className="font-numeric tabular-nums text-ink">
                  {formatDuration(activeWin.end.getTime() - now)}
                </span>{' '}
                left · ends {formatClock(activeWin.end)}
              </p>
              <div className="mt-4 h-0.5 w-full overflow-hidden bg-border">
                <motion.div
                  className="h-full bg-accent"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round(progress * 100)}%` }}
                  transition={{ delay: 0.35, duration: 0.8, ease: EASE_OUT }}
                />
              </div>
            </>
          ) : nextWin ? (
            <>
              <p className="eyebrow">Next prayer</p>
              <p className="mt-2 font-serif text-6xl leading-none tracking-tight text-ink">{nextWin.name}</p>
              <p className="mt-3 text-sm text-ink-muted">
                in{' '}
                <span className="font-numeric tabular-nums text-ink">
                  {formatDuration(nextWin.start.getTime() - now)}
                </span>{' '}
                · starts {formatClock(nextWin.start)}
              </p>
            </>
          ) : null}
        </Block>

        <Block index={3} className="mt-8">
          <ul className="divide-y divide-border">
            {day.windows.map((w) => {
              const status = statusOf(w);
              return (
                <li key={w.key} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={clsx(
                        'h-2 w-2 shrink-0 rounded-full',
                        status === 'active' ? 'bg-accent' : status === 'past' ? 'bg-ink/20' : 'bg-border'
                      )}
                      aria-hidden
                    />
                    <span
                      className={clsx(
                        'text-base',
                        status === 'past' ? 'text-ink-faint' : 'text-ink',
                        status === 'active' && 'font-semibold'
                      )}
                    >
                      {w.name}
                    </span>
                  </div>
                  <span
                    className={clsx(
                      'font-numeric text-sm tabular-nums',
                      status === 'active' ? 'text-accent' : status === 'past' ? 'text-ink-faint' : 'text-ink-muted'
                    )}
                  >
                    {formatClock(w.start)} – {formatClock(w.end)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Block>

        <Block index={4} className="mt-8">
          <p className="eyebrow">Prohibited times</p>
          <ul className="mt-2 divide-y divide-border">
            {day.prohibited.map((p) => {
              const on = p.key === prohibitedNow?.key;
              const over = p.end.getTime() <= now;
              return (
                <li key={p.key} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <span
                      className={clsx('h-2 w-2 shrink-0 rounded-full', on ? 'bg-danger' : over ? 'bg-ink/20' : 'bg-danger/40')}
                      aria-hidden
                    />
                    <span className={clsx('text-sm', on ? 'font-semibold text-danger' : over ? 'text-ink-faint' : 'text-ink')}>
                      {p.name}
                    </span>
                  </div>
                  <span
                    className={clsx(
                      'font-numeric text-sm tabular-nums',
                      on ? 'text-danger' : over ? 'text-ink-faint' : 'text-ink-muted'
                    )}
                  >
                    {formatClock(p.start)} – {formatClock(p.end)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Block>

        <Block index={5} className="mt-6">
          <p className="text-xs text-ink-faint">
            Voluntary (nafl) prayers are also not allowed after praying Fajr until sunrise, and after praying Asr until
            sunset.
          </p>
          <p className="mt-2 text-xs text-ink-faint">
            Follows the Islamic Foundation Bangladesh rules, calculated for {city.name}. A minute or two can differ from
            the printed timetable, so check it for your area.
          </p>
        </Block>
      </motion.div>
    </motion.div>
  );
}
