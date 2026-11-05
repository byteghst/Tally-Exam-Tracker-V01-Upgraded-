import '@fontsource/amiri-quran/400.css';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, BookOpen } from 'lucide-react';
import { EASE_OUT } from '@/lib/motion';
import { todayISO } from '@/lib/dates';
import { ayahRef, loadAyahData, pickAyahIndex, quranComUrl, type AyahData } from '@/lib/ayah';

/**
 * A fixed, round emerald-and-gold button at the bottom left of the dashboard.
 * Tapping it opens a popup with today's reflection from the Quran: the same
 * ayah of the day as the dashboard card, picked by date, so it works offline.
 * All text comes from the unmodified Tanzil files; nothing here edits it.
 *
 * Drawn into document.body so it floats above the page and is not tied to the
 * layout. The prayer button lives on the right, so the two never overlap.
 */
export function QuranReflectionFab() {
  const [open, setOpen] = useState(false);

  return createPortal(
    <>
      <motion.button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Daily Quran reflection"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: open ? 0 : 1, scale: open ? 0.85 : 1 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        style={{
          left: '1rem',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 6rem)',
          pointerEvents: open ? 'none' : 'auto'
        }}
        className="fixed z-40 h-14 w-14"
      >
        {/* soft golden glow behind the button */}
        <motion.span
          aria-hidden
          className="absolute -inset-1.5 rounded-full blur-md"
          style={{ background: '#c9a227' }}
          animate={{ opacity: [0.25, 0.55, 0.25] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
        />
        <span
          className="relative flex h-full w-full items-center justify-center rounded-full text-white shadow-raise"
          style={{
            background: 'linear-gradient(145deg, #0b4a30 0%, #1f7a50 100%)',
            border: '2px solid #c9a227'
          }}
        >
          <BookOpen size={24} strokeWidth={2} />
        </span>
      </motion.button>

      <AnimatePresence>{open && <ReflectionOverlay onClose={() => setOpen(false)} />}</AnimatePresence>
    </>,
    document.body
  );
}

function ReflectionOverlay({ onClose }: { onClose: () => void }) {
  const [data, setData] = useState<AyahData | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    loadAyahData().then((d) => {
      if (alive) {
        setData(d);
        setLoaded(true);
      }
    });
    return () => {
      alive = false;
    };
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

  const entry = data && data.entries.length > 0 ? data.entries[pickAyahIndex(data.entries.length, todayISO())] : null;
  const multi = (entry?.verses.length ?? 0) > 1;

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
        aria-label="Daily Quran reflection"
        className="relative max-h-[86dvh] w-full max-w-md overflow-y-auto rounded-[28px] bg-surface-raised p-6 shadow-sheet"
        // grows out of the button at the bottom left and shrinks back into it
        style={{ transformOrigin: '0% 100%' }}
        initial={{ opacity: 0, scale: 0.45, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.55, y: 30, transition: { duration: 0.24, ease: EASE_OUT } }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      >
        <div className="flex items-center justify-between gap-3">
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
          <span className="eyebrow">Daily reflection</span>
        </div>

        {!loaded ? (
          <p className="mt-8 text-center text-sm text-ink-muted">Loading…</p>
        ) : !entry || !data ? (
          <p className="mt-8 text-center text-sm text-ink-muted">Today’s reflection isn’t available right now.</p>
        ) : (
          <>
            <div className="mt-6 space-y-6">
              {entry.verses.map((v) => (
                <div key={v.n} className="space-y-3">
                  {multi && <p className="font-numeric text-xs tabular-nums text-ink-faint">Ayah {v.n}</p>}
                  <p
                    dir="rtl"
                    lang="ar"
                    className="text-[1.75rem] leading-[2.2] text-ink"
                    style={{ fontFamily: '"Amiri Quran", serif' }}
                  >
                    {v.ar}
                  </p>
                  <p lang="en" className="text-sm leading-relaxed text-ink">
                    {v.en}
                  </p>
                  <p lang="bn" className="text-sm leading-relaxed text-ink">
                    {v.bn}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between gap-3">
              <p className="text-xs text-ink-muted">
                Surah {entry.surahName} ({ayahRef(entry)})
              </p>
              <a
                href={quranComUrl(entry)}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs font-semibold text-accent"
              >
                Read in context
              </a>
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
              Arabic: Uthmani text · English: {data.meta.sources.en.label} · Bengali: {data.meta.sources.bn.label}. Text
              from the{' '}
              <a href="https://tanzil.net" target="_blank" rel="noopener noreferrer" className="underline">
                Tanzil project
              </a>
              , unaltered.
            </p>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
