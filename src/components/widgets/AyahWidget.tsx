import '@fontsource/amiri-quran/400.css';
import { useEffect, useState } from 'react';
import { Section } from '@/components/motion/Reveal';
import { todayISO } from '@/lib/dates';
import { ayahRef, loadAyahData, pickAyahIndex, quranComUrl, type AyahData } from '@/lib/ayah';

/**
 * One ayah a day, picked by date so it needs no storage and works offline.
 * All text comes from the unmodified Tanzil files (see scripts/build-ayah-data.mjs);
 * nothing here edits or re-types it. Hidden until that data exists.
 */
export function AyahWidget() {
  const [data, setData] = useState<AyahData | null>(null);

  useEffect(() => {
    let alive = true;
    loadAyahData().then((d) => {
      if (alive) setData(d);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!data || data.entries.length === 0) return null;
  const entry = data.entries[pickAyahIndex(data.entries.length, todayISO())];
  if (!entry) return null;
  const { sources } = data.meta;
  const multi = entry.verses.length > 1;

  return (
    <Section
      label="Ayah of the day"
      card
      className="md:col-span-2"
      aside={
        <a
          href={quranComUrl(entry)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-semibold text-accent"
        >
          Read in context
        </a>
      }
    >
      <div className="space-y-6">
        {entry.verses.map((v) => (
          <div key={v.n} className="space-y-3">
            {multi && <p className="font-numeric text-xs tabular-nums text-ink-faint">Ayah {v.n}</p>}
            <p dir="rtl" lang="ar" className="text-[1.75rem] leading-[2.2] text-ink" style={{ fontFamily: '"Amiri Quran", serif' }}>
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

      <p className="mt-5 text-xs text-ink-muted">
        Surah {entry.surahName} ({ayahRef(entry)})
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-ink-faint">
        Arabic: Uthmani text · English: {sources.en.label} · Bengali: {sources.bn.label}. Text from the{' '}
        <a href="https://tanzil.net" target="_blank" rel="noopener noreferrer" className="underline">
          Tanzil project
        </a>
        , unaltered.
      </p>
    </Section>
  );
}
