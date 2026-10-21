import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Ban, Check, ChevronDown, MapPin, X } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { clsx } from 'clsx';
import { EASE_OUT } from '@/lib/motion';
import { parseISODate, todayISO } from '@/lib/dates';
import { BD_CITIES, findCity, type BdCity } from '@/lib/prayer/cities';
import { ENDING_WARNING_MINUTES } from '@/lib/notifications/prayerPlan';
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
import { fullDayStreak, lastDays, previousDayISO, PRAYER_KEYS, usePrayerLogStore } from '@/store/prayerLogStore';

const SELECT_CLASS =
  'mt-3 h-12 w-full rounded-control border-0 bg-ink/[0.05] px-3 text-base text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50';

/** Where the pill rests after being moved: which screen edge, and how far down. */
interface PillPos {
  side: 'left' | 'right';
  y: number;
}

const POS_KEY = 'tally.prayerPill';
const EDGE = 8; // gap to the left/right/bottom screen edge
const TOP_EDGE = 48; // keeps the pill clear of the status bar
const DRAG_THRESHOLD = 6; // px of movement before a press becomes a drag

const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

function loadPos(): PillPos | null {
  try {
    const raw = window.localStorage.getItem(POS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<PillPos>;
    if ((p.side === 'left' || p.side === 'right') && typeof p.y === 'number') return { side: p.side, y: p.y };
  } catch {
    /* storage unavailable or corrupt: use the default spot */
  }
  return null;
}

function savePos(p: PillPos): void {
  try {
    window.localStorage.setItem(POS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

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
 * Tapping it opens the full prayer times, the prayer tracker and the reminder
 * switches in a popup that grows out of the button; the Back button (or
 * Escape, or a tap outside) closes it again. Tapping a prayer notification
 * opens the same popup.
 *
 * The pill can be dragged anywhere on screen so it never covers anything; it
 * snaps to the nearest side edge on release and remembers where it was left.
 *
 * It is drawn into document.body so it floats above everything and is not
 * tied to the page's layout or animations.
 */
export function PrayerFab() {
  const view = usePrayerView();
  const [open, setOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<PillPos | null>(loadPos);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const [viewportH, setViewportH] = useState(() => window.innerHeight);
  const gesture = useRef<{ dx: number; dy: number; sx: number; sy: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  // a prayer notification opens /dashboard?prayer=1: show the popup, then tidy the address
  useEffect(() => {
    if (searchParams.get('prayer') === '1') {
      setOpen(true);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // keep a saved spot on screen if the window is resized or rotated
  useEffect(() => {
    const onResize = () => setViewportH(window.innerHeight);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (open || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const r = e.currentTarget.getBoundingClientRect();
    gesture.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, sx: e.clientX, sy: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    if (!g) return;
    if (!g.moved) {
      if (Math.hypot(e.clientX - g.sx, e.clientY - g.sy) < DRAG_THRESHOLD) return;
      g.moved = true;
      setDragging(true);
    }
    const w = e.currentTarget.offsetWidth;
    const h = e.currentTarget.offsetHeight;
    setDrag({
      x: clamp(e.clientX - g.dx, EDGE, window.innerWidth - w - EDGE),
      y: clamp(e.clientY - g.dy, TOP_EDGE, window.innerHeight - h - EDGE)
    });
  }

  function endGesture(e: React.PointerEvent<HTMLButtonElement>) {
    const g = gesture.current;
    gesture.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (!g || !g.moved) return;

    // swallow the click that follows a drag so it does not open the popup
    suppressClick.current = true;
    window.setTimeout(() => (suppressClick.current = false), 60);

    const w = e.currentTarget.offsetWidth;
    const h = e.currentTarget.offsetHeight;
    const x = clamp(e.clientX - g.dx, EDGE, window.innerWidth - w - EDGE);
    const y = clamp(e.clientY - g.dy, TOP_EDGE, window.innerHeight - h - EDGE);
    const side: PillPos['side'] = x + w / 2 < window.innerWidth / 2 ? 'left' : 'right';

    // glide to the edge, then hand over to the saved position
    setDragging(false);
    setDrag({ x: side === 'left' ? EDGE : window.innerWidth - w - EDGE, y });
    const next: PillPos = { side, y };
    savePos(next);
    window.setTimeout(() => {
      setPos(next);
      setDrag(null);
    }, 240);
  }

  const label = view.activeWin ? view.activeWin.name : view.nextWin ? `Next · ${view.nextWin.name}` : 'Prayer';
  const sub = view.activeWin
    ? `${formatDuration(view.activeWin.end.getTime() - view.now)} left`
    : view.nextWin
      ? `in ${formatDuration(view.nextWin.start.getTime() - view.now)}`
      : '';
  const danger = view.prohibitedNow !== null;

  // default: bottom right above the nav. Moved: wherever it was left.
  let placement: CSSProperties;
  if (drag) {
    placement = { left: drag.x, top: drag.y };
  } else if (pos) {
    const h = btnRef.current?.offsetHeight ?? 52;
    const top = clamp(pos.y, TOP_EDGE, Math.max(TOP_EDGE, viewportH - h - EDGE));
    placement = pos.side === 'left' ? { left: EDGE, top } : { right: EDGE, top };
  } else {
    placement = { right: '1rem', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 6rem)' };
  }
  const popupSide: PillPos['side'] = (drag ? drag.x + 70 < window.innerWidth / 2 : pos?.side === 'left') ? 'left' : 'right';
  const popupBottom = !drag && !pos;

  return createPortal(
    <>
      <motion.button
        ref={btnRef}
        type="button"
        onClick={() => {
          if (suppressClick.current) return;
          setOpen(true);
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endGesture}
        onPointerCancel={endGesture}
        aria-label={`Prayer times. ${label}${sub ? `, ${sub}` : ''}${danger ? '. Prohibited time now' : ''}. Drag to move`}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: open ? 0 : 1, scale: dragging ? 1.06 : open ? 0.85 : 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        style={{ ...placement, pointerEvents: open ? 'none' : 'auto', touchAction: 'none' }}
        className={clsx(
          'fixed z-40 flex cursor-grab select-none items-center gap-3 rounded-full bg-ink py-3 pl-4 pr-5 text-surface shadow-raise active:cursor-grabbing',
          !dragging && 'transition-[left,top] duration-200 ease-out',
          popupBottom && 'md:bottom-8 md:right-8'
        )}
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

      <AnimatePresence>
        {open && <PrayerOverlay view={view} originX={popupSide} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>,
    document.body
  );
}

/** One block of the popup, fading up a moment after the one before it. */
function Block({ index, className, children }: { index: number; className?: string; children: ReactNode }) {
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

/** A labelled on/off switch row, shown as a soft tile. */
function ReminderSwitch({
  label,
  hint,
  checked,
  onChange,
  danger
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (on: boolean) => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center justify-between gap-4 rounded-control bg-ink/[0.04] px-4 py-3 text-left transition-colors active:bg-ink/[0.07]"
    >
      <span>
        <span className="block text-sm text-ink">{label}</span>
        <span className="mt-0.5 block text-xs text-ink-faint">{hint}</span>
      </span>
      <span
        className={clsx(
          'relative h-6 w-10 shrink-0 rounded-full transition-colors',
          checked ? (danger ? 'bg-danger' : 'bg-accent') : 'bg-ink/20'
        )}
        aria-hidden
      >
        <span
          className={clsx(
            'absolute top-0.5 h-5 w-5 rounded-full bg-surface-raised shadow transition-all',
            checked ? 'left-[18px]' : 'left-0.5'
          )}
        />
      </span>
    </button>
  );
}

/** Key to the three circle states in the prayer list: one small picture per meaning. */
function TrackerLegend() {
  const items: Array<{ chip: string; icon: ReactNode; text: string }> = [
    { chip: 'bg-forest text-surface-raised', icon: <Check size={11} strokeWidth={3.5} />, text: 'Prayed' },
    { chip: 'bg-danger/15 text-danger', icon: <X size={11} strokeWidth={3.5} />, text: 'Missed' },
    { chip: 'bg-ink/10 opacity-60', icon: null, text: 'Locked' }
  ];
  return (
    <ul
      className="mt-3 flex items-center justify-between rounded-full bg-ink/[0.04] px-5 py-2.5"
      aria-label="What the circles mean: prayed, missed, locked"
    >
      {items.map((it) => (
        <li key={it.text} className="flex items-center gap-2">
          <span className={clsx('flex h-[18px] w-[18px] items-center justify-center rounded-full', it.chip)} aria-hidden>
            {it.icon}
          </span>
          <span className="font-serif text-[15px] italic text-ink-muted">{it.text}</span>
        </li>
      ))}
    </ul>
  );
}

/** A short note with its own icon, set in the serif face so it reads apart from the data. */
function Note({
  icon,
  tone,
  title,
  children
}: {
  icon: ReactNode;
  tone: 'danger' | 'accent';
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-3.5 rounded-card bg-ink/[0.04] p-4">
      <span
        className={clsx(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
          tone === 'danger' ? 'bg-danger/10 text-danger' : 'bg-accent-soft text-accent'
        )}
        aria-hidden
      >
        {icon}
      </span>
      <div>
        <p className="font-serif text-lg leading-tight text-ink">{title}</p>
        <p className="mt-1 font-serif text-[15px] leading-snug text-ink-muted">{children}</p>
      </div>
    </div>
  );
}

function PrayerOverlay({
  view,
  originX,
  onClose
}: {
  view: PrayerView;
  originX: 'left' | 'right';
  onClose: () => void;
}) {
  const cityName = usePrayerStore((s) => s.cityName);
  const setCity = usePrayerStore((s) => s.setCity);
  const remindStart = usePrayerStore((s) => s.remindStart);
  const remindEnding = usePrayerStore((s) => s.remindEnding);
  const remindProhibited = usePrayerStore((s) => s.remindProhibited);
  const setRemindStart = usePrayerStore((s) => s.setRemindStart);
  const setRemindEnding = usePrayerStore((s) => s.setRemindEnding);
  const setRemindProhibited = usePrayerStore((s) => s.setRemindProhibited);
  const logDays = usePrayerLogStore((s) => s.days);
  const logLoaded = usePrayerLogStore((s) => s.loaded);
  const toggle = usePrayerLogStore((s) => s.toggle);
  const [changingCity, setChangingCity] = useState(false);
  const { now, city, day, activeKey, activeWin, nextWin, progress, prohibitedNow } = view;
  const isNative = Capacitor.isNativePlatform();

  // Read the tracker from the account when the popup opens.
  useEffect(() => {
    void usePrayerLogStore.getState().hydrate();
  }, []);

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

  // Tracker. Between midnight and Fajr the running Isha is still last night's,
  // so that one is saved against yesterday; everything else is today's.
  const todayKey = todayISO();
  const beforeFajr = now < day.windows[0].start.getTime();
  const dateFor = (key: PrayerKey): string => (key === 'isha' && beforeFajr ? previousDayISO(todayKey) : todayKey);
  const isPrayed = (key: PrayerKey): boolean => (logDays[dateFor(key)] ?? []).includes(key);
  const prayedToday = PRAYER_KEYS.filter((k) => (logDays[todayKey] ?? []).includes(k)).length;
  const streak = fullDayStreak(logDays, todayKey);
  const week = lastDays(todayKey, 7);

  // A prayer can only be marked while it is running: not before it starts, and
  // not once its time is over. Checked against the live clock, so a popup left
  // open past the end of a prayer cannot still tick it.
  function canMark(w: PrayerWindow): boolean {
    const t = Date.now();
    const start = w.key === 'isha' && beforeFajr ? day.prevIshaStart.getTime() : w.start.getTime();
    const end = w.key === 'isha' && beforeFajr ? day.windows[0].start.getTime() : w.end.getTime();
    return t >= start && t < end;
  }

  function markPrayer(w: PrayerWindow): void {
    if (!canMark(w)) return;
    void toggle(dateFor(w.key), w.key);
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
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-label="Prayer times"
        className="relative max-h-[86dvh] w-full max-w-md overflow-y-auto rounded-[28px] bg-surface-raised p-6 shadow-sheet"
        // grows out of the floating button (on whichever side it sits) and shrinks back into it
        style={{ transformOrigin: originX === 'left' ? '0% 100%' : '100% 100%' }}
        initial={{ opacity: 0, scale: 0.45, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.55, y: 30, transition: { duration: 0.24, ease: EASE_OUT } }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      >
        <Block index={0} className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            aria-label="Back"
            className="flex items-center gap-1.5 rounded-full bg-ink/[0.06] py-2 pl-3 pr-4 text-sm font-semibold text-ink transition-colors hover:bg-ink/10"
          >
            <ArrowLeft size={18} />
            Back
          </button>
          <button
            type="button"
            onClick={() => setChangingCity((v) => !v)}
            aria-expanded={changingCity}
            aria-label={`Prayer times for ${city.name}. Change district`}
            className="flex items-center gap-1 rounded-full bg-accent-soft py-2 pl-4 pr-3 text-xs font-semibold uppercase tracking-[0.16em] text-accent"
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
          <Block index={1} className="mt-5">
            <div role="alert" className="rounded-control bg-danger/10 px-4 py-3">
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

        <Block index={2} className="mt-5">
          <div className="rounded-card bg-accent-soft p-5">
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
                <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-ink/10">
                  <motion.div
                    className="h-full rounded-full bg-accent"
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
          </div>
        </Block>

        {/* tracker summary: how many today, the streak, and the last seven days */}
        <Block index={3} className="mt-3">
          <div className="rounded-card bg-ink/[0.04] p-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Prayed today</p>
                <p className="mt-1 font-serif text-4xl leading-none tracking-tight text-ink">
                  <span className="font-numeric tabular-nums">{prayedToday}</span>
                  <span className="text-ink-faint">/5</span>
                </p>
              </div>
              <div className="text-right">
                <p className="eyebrow">Streak</p>
                <p className="mt-1 font-numeric text-xl tabular-nums text-ink">
                  {streak} {streak === 1 ? 'day' : 'days'}
                </p>
              </div>
            </div>

            <div className="mt-5 flex items-end justify-between gap-2" aria-label="Prayers marked in the last seven days">
              {week.map((date) => {
                const count = logDays[date]?.length ?? 0;
                const isToday = date === todayKey;
                return (
                  <div key={date} className="flex flex-1 flex-col items-center gap-1.5">
                    <div className="flex h-10 w-full items-end justify-center">
                      <div
                        className={clsx(
                          'w-2.5 rounded-full transition-[height] duration-500',
                          count >= 5 ? 'bg-forest' : count > 0 ? 'bg-accent' : 'bg-ink/15'
                        )}
                        style={{ height: count > 0 ? `${Math.max(14, (count / 5) * 100)}%` : '6px' }}
                      />
                    </div>
                    <span className={clsx('text-[11px] font-semibold', isToday ? 'text-ink' : 'text-ink-faint')}>
                      {parseISODate(date).toLocaleDateString('en-US', { weekday: 'narrow' })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </Block>

        <Block index={4} className="mt-3">
          <ul className="space-y-1.5">
            {day.windows.map((w) => {
              const status = statusOf(w);
              const prayed = isPrayed(w.key);
              // only the running prayer can be marked; a finished one is locked as it was
              const markable = status === 'active';
              // time ended with no tick: missed or qada. Only judged once the log has
              // really loaded, so a failed read or being offline never shows false crosses.
              const missed = logLoaded && status === 'past' && !prayed;
              return (
                <li
                  key={w.key}
                  className={clsx(
                    'flex items-center justify-between gap-3 rounded-control px-3 py-2.5',
                    status === 'active' ? 'bg-accent-soft' : 'bg-ink/[0.04]'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={!markable}
                      onClick={() => markPrayer(w)}
                      aria-pressed={prayed}
                      aria-label={
                        markable
                          ? `Mark ${w.name} as ${prayed ? 'not prayed' : 'prayed'}`
                          : missed
                            ? `${w.name} was missed: its time ended without being ticked`
                            : status === 'past'
                              ? `${w.name} time has ended, so it can no longer be changed`
                              : `${w.name} has not started yet`
                      }
                      className={clsx(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors',
                        prayed
                          ? 'bg-forest text-surface-raised'
                          : missed
                            ? 'bg-danger/15 text-danger'
                            : 'bg-ink/10 text-transparent',
                        !markable && 'cursor-not-allowed',
                        !markable && !missed && (status === 'upcoming' || !prayed) && 'opacity-30'
                      )}
                    >
                      {missed ? <X size={16} strokeWidth={3} /> : <Check size={16} strokeWidth={3} />}
                    </button>
                    <span
                      className={clsx(
                        'text-base',
                        status === 'past' && !prayed ? 'text-ink-muted' : 'text-ink',
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
          <TrackerLegend />
        </Block>

        <Block index={5} className="mt-7">
          <p className="eyebrow">Prohibited times</p>
          <ul className="mt-3 space-y-1.5">
            {day.prohibited.map((p) => {
              const on = p.key === prohibitedNow?.key;
              const over = p.end.getTime() <= now;
              return (
                <li
                  key={p.key}
                  className={clsx(
                    'flex items-center justify-between gap-3 rounded-control px-3 py-2.5',
                    on ? 'bg-danger/10' : 'bg-ink/[0.04]'
                  )}
                >
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

        <Block index={6} className="mt-7">
          <p className="eyebrow">Reminders</p>
          <div className="mt-3 space-y-1.5">
            <ReminderSwitch
              label="When a prayer begins"
              hint="A notification as each prayer time starts"
              checked={remindStart}
              onChange={setRemindStart}
            />
            <ReminderSwitch
              label={`${ENDING_WARNING_MINUTES} minutes before it ends`}
              hint="Skipped for a prayer you have already ticked"
              checked={remindEnding}
              onChange={setRemindEnding}
            />
            <ReminderSwitch
              label="Prohibited times"
              hint="A special red alert when one begins"
              checked={remindProhibited}
              onChange={setRemindProhibited}
              danger
            />
          </div>
          {!isNative && (
            <p className="mt-2 text-xs text-ink-faint">
              Prayer reminders arrive in the Android app. A web page can’t wake up at prayer time.
            </p>
          )}
        </Block>

        <Block index={7} className="mt-7">
          <p className="eyebrow">Good to know</p>
          <div className="mt-3 space-y-2">
            <Note icon={<Ban size={17} />} tone="danger" title="No nafl after Fajr and Asr">
              Voluntary prayers are not allowed after praying Fajr until sunrise, and after praying Asr until sunset.
            </Note>
            <Note icon={<MapPin size={17} />} tone="accent" title={`Timed for ${city.name}`}>
              Follows the Islamic Foundation Bangladesh rules. A minute or two can differ from the printed timetable.
            </Note>
          </div>
        </Block>
      </motion.div>
    </motion.div>
  );
}
