import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Section } from '@/components/motion/Reveal';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { EASE_OUT } from '@/lib/motion';
import { BD_CITIES, findCity } from '@/lib/prayer/cities';
import {
  computeDay,
  formatClock,
  formatDuration,
  IF_RULES,
  type PrayerKey,
  type PrayerWindow
} from '@/lib/prayer/times';
import { usePrayerStore } from '@/store/prayerStore';

const SELECT_CLASS =
  'mt-2 w-full rounded-control border border-border bg-surface px-3 py-2.5 text-base text-ink';

/**
 * Always on the dashboard: today's five prayers with the time each one begins
 * and when its time runs out (Fajr until sunrise, Dhuhr until Asr, and so on),
 * the prayer that is running right now with a countdown, and what is next.
 * It also marks the three prohibited times (sunrise, the sun at its highest,
 * sunset) and warns while one of them is happening. All of it follows the
 * Islamic Foundation Bangladesh rules (see lib/prayer/times).
 * Calculated on the device; no internet needed.
 */
export function PrayerTimesWidget() {
  const cityName = usePrayerStore((s) => s.cityName);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // re-check twice a minute so the countdown and highlight stay current
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const city = findCity(cityName);
  const dayKey = new Date(now).toDateString();
  const day = useMemo(
    () => computeDay(new Date(now), city.lat, city.lng),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dayKey, city.lat, city.lng]
  );

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

  // Is a prohibited time happening right now?
  const prohibitedNow = day.prohibited.find((p) => now >= p.start.getTime() && now < p.end.getTime()) ?? null;

  function statusOf(w: PrayerWindow): 'active' | 'past' | 'upcoming' {
    if (w.key === activeKey) return 'active';
    return w.end.getTime() <= now ? 'past' : 'upcoming';
  }

  return (
    <Section
      label="Prayer times"
      aside={
        <button
          onClick={() => setSettingsOpen(true)}
          aria-label={`Prayer times for ${city.name}. Change district`}
          className="text-xs font-semibold uppercase tracking-[0.16em] text-accent"
        >
          {city.name}
        </button>
      }
    >
      {prohibitedNow && (
        <div role="alert" className="mb-6 border-l-2 border-danger bg-danger/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-danger">Prohibited time now</p>
          <p className="mt-1 text-sm text-ink">{prohibitedNow.detail}</p>
          <p className="mt-1 text-sm text-ink-muted">
            Until{' '}
            <span className="font-numeric tabular-nums text-ink">{formatClock(prohibitedNow.end)}</span> ·{' '}
            <span className="font-numeric tabular-nums">{formatDuration(prohibitedNow.end.getTime() - now)}</span> left
          </p>
        </div>
      )}

      {activeWin ? (
        <div>
          <p className="font-serif text-5xl leading-none tracking-tight text-ink">{activeWin.name}</p>
          <p className="mt-2 text-sm text-ink-muted">
            <span className="font-numeric tabular-nums text-ink">{formatDuration(activeWin.end.getTime() - now)}</span>{' '}
            left · ends {formatClock(activeWin.end)}
          </p>
          <div className="mt-4 h-0.5 w-full overflow-hidden bg-border">
            <motion.div
              className="h-full bg-accent"
              initial={false}
              animate={{ width: `${Math.round(progress * 100)}%` }}
              transition={{ duration: 0.6, ease: EASE_OUT }}
            />
          </div>
        </div>
      ) : nextWin ? (
        <div>
          <p className="eyebrow">Next prayer</p>
          <p className="mt-2 font-serif text-5xl leading-none tracking-tight text-ink">{nextWin.name}</p>
          <p className="mt-2 text-sm text-ink-muted">
            in <span className="font-numeric tabular-nums text-ink">{formatDuration(nextWin.start.getTime() - now)}</span>{' '}
            · starts {formatClock(nextWin.start)}
          </p>
        </div>
      ) : null}

      <ul className="mt-6 divide-y divide-border">
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

      <div className="mt-6">
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
        <p className="mt-3 text-xs text-ink-faint">
          Voluntary (nafl) prayers are also not allowed after praying Fajr until sunrise, and after praying Asr until
          sunset.
        </p>
      </div>

      <p className="mt-3 text-xs text-ink-faint">
        Follows the Islamic Foundation Bangladesh rules, calculated for {city.name}: {IF_RULES.precautionMinutes} minutes
        added to Fajr, Dhuhr and Maghrib, and no prayer for {IF_RULES.afterSunriseMinutes} min after sunrise,{' '}
        {IF_RULES.beforeDhuhrMinutes} min before Dhuhr and {IF_RULES.beforeSunsetMinutes} min before sunset. Minutes can
        differ by a minute or two from the printed timetable, so check it for your area.
      </p>

      {settingsOpen && <PrayerSettingsSheet onClose={() => setSettingsOpen(false)} />}
    </Section>
  );
}

function PrayerSettingsSheet({ onClose }: { onClose: () => void }) {
  const cityName = usePrayerStore((s) => s.cityName);
  const setCity = usePrayerStore((s) => s.setCity);

  return (
    <Sheet
      open
      onClose={onClose}
      title="Prayer times"
      footer={
        <div className="flex justify-end">
          <Button onClick={onClose}>Done</Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <label htmlFor="prayer-city" className="eyebrow">
            District
          </label>
          <select id="prayer-city" value={cityName} onChange={(e) => setCity(e.target.value)} className={SELECT_CLASS}>
            {BD_CITIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <p className="text-sm text-ink-muted">
          Prayer times and prohibited times follow the Islamic Foundation Bangladesh rules (Karachi method, Hanafi Asr,
          3 minutes added to Fajr, Dhuhr and Maghrib). Your district is kept on this device only.
        </p>
      </div>
    </Sheet>
  );
}
