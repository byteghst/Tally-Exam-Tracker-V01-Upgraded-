// Builds src/data/ayah-data.json for the "Ayah of the day" widget.
//
// Nothing in that file is typed by hand. Every word of Quran text and
// translation is copied from the three unmodified Tanzil files in data/tanzil/.
// The only hand-written input is src/data/ayah-refs.json (verse references).
//
// If the Tanzil files are not there yet the script skips quietly (the widget
// stays hidden). If they are there but anything is wrong, it fails the build.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = process.env.AYAH_SRC_DIR || path.join(ROOT, 'data/tanzil');
const REFS_PATH = process.env.AYAH_REFS || path.join(ROOT, 'src/data/ayah-refs.json');
const OUT_PATH = process.env.AYAH_OUT || path.join(ROOT, 'src/data/ayah-data.json');

export const SOURCES = {
  ar: { file: 'quran-uthmani.txt', tanzilId: 'uthmani', label: 'Quran (Uthmani text)', script: /[\u0600-\u06FF]/ },
  en: { file: 'en.sahih.txt', tanzilId: 'en.sahih', label: 'Saheeh International', script: /[A-Za-z]/ },
  bn: { file: 'bn.bengali.txt', tanzilId: 'bn.bengali', label: 'Muhiuddin Khan', script: /[\u0980-\u09FF]/ }
};

// Verses per surah, used only to check the files are complete and the refs exist.
export const AYAH_COUNTS = [
  7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135, 112, 78, 118, 64, 77,
  227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38, 29, 18, 45, 60, 49, 62, 55,
  78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40, 31, 50, 40, 46, 42, 29, 19, 36,
  25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5, 4, 7, 3, 6, 3, 5, 4, 5, 6
];
export const TOTAL_AYAHS = 6236;

// Standard transliterated surah names (labels only, not Quran text).
export const SURAH_NAMES = [
  'Al-Fatihah', 'Al-Baqarah', "Ali 'Imran", 'An-Nisa', "Al-Ma'idah", "Al-An'am", "Al-A'raf", 'Al-Anfal', 'At-Tawbah',
  'Yunus', 'Hud', 'Yusuf', "Ar-Ra'd", 'Ibrahim', 'Al-Hijr', 'An-Nahl', 'Al-Isra', 'Al-Kahf', 'Maryam', 'Ta-Ha',
  'Al-Anbiya', 'Al-Hajj', "Al-Mu'minun", 'An-Nur', 'Al-Furqan', "Ash-Shu'ara", 'An-Naml', 'Al-Qasas', "Al-'Ankabut",
  'Ar-Rum', 'Luqman', 'As-Sajdah', 'Al-Ahzab', 'Saba', 'Fatir', 'Ya-Sin', 'As-Saffat', 'Sad', 'Az-Zumar', 'Ghafir',
  'Fussilat', 'Ash-Shura', 'Az-Zukhruf', 'Ad-Dukhan', 'Al-Jathiyah', 'Al-Ahqaf', 'Muhammad', 'Al-Fath', 'Al-Hujurat',
  'Qaf', 'Adh-Dhariyat', 'At-Tur', 'An-Najm', 'Al-Qamar', 'Ar-Rahman', "Al-Waqi'ah", 'Al-Hadid', 'Al-Mujadila',
  'Al-Hashr', 'Al-Mumtahanah', 'As-Saff', "Al-Jumu'ah", 'Al-Munafiqun', 'At-Taghabun', 'At-Talaq', 'At-Tahrim',
  'Al-Mulk', 'Al-Qalam', 'Al-Haqqah', "Al-Ma'arij", 'Nuh', 'Al-Jinn', 'Al-Muzzammil', 'Al-Muddaththir', 'Al-Qiyamah',
  'Al-Insan', 'Al-Mursalat', 'An-Naba', "An-Nazi'at", "'Abasa", 'At-Takwir', 'Al-Infitar', 'Al-Mutaffifin',
  'Al-Inshiqaq', 'Al-Buruj', 'At-Tariq', "Al-A'la", 'Al-Ghashiyah', 'Al-Fajr', 'Al-Balad', 'Ash-Shams', 'Al-Layl',
  'Ad-Duha', 'Ash-Sharh', 'At-Tin', "Al-'Alaq", 'Al-Qadr', 'Al-Bayyinah', 'Az-Zalzalah', "Al-'Adiyat", "Al-Qari'ah",
  'At-Takathur', "Al-'Asr", 'Al-Humazah', 'Al-Fil', 'Quraysh', "Al-Ma'un", 'Al-Kawthar', 'Al-Kafirun', 'An-Nasr',
  'Al-Masad', 'Al-Ikhlas', 'Al-Falaq', 'An-Nas'
];

const MAX_RANGE = 4;

class DataError extends Error {}

/** Parses a Tanzil "text with verse numbers" file: lines of `surah|ayah|text`; `#` lines are the licence notice. */
export function parseTanzil(raw, name) {
  const verses = new Map();
  const notice = [];
  for (const line of raw.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    if (!line.trim()) continue;
    if (line.startsWith('#')) {
      notice.push(line.replace(/^#\s?/, '').trimEnd());
      continue;
    }
    const m = /^(\d{1,3})\|(\d{1,3})\|(.+)$/.exec(line);
    if (!m) throw new DataError(`${name}: unreadable line: ${line.slice(0, 60)}`);
    const key = `${Number(m[1])}:${Number(m[2])}`;
    if (verses.has(key)) throw new DataError(`${name}: duplicate verse ${key}`);
    verses.set(key, m[3].trim());
  }
  if (verses.size !== TOTAL_AYAHS) {
    throw new DataError(`${name}: expected ${TOTAL_AYAHS} verses, found ${verses.size}. Is it the full "text with verse numbers" file?`);
  }
  AYAH_COUNTS.forEach((count, i) => {
    for (let a = 1; a <= count; a++) {
      if (!verses.has(`${i + 1}:${a}`)) throw new DataError(`${name}: missing verse ${i + 1}:${a}`);
    }
  });
  return { verses, notice };
}

export function parseRef(ref) {
  const m = /^(\d{1,3}):(\d{1,3})(?:-(\d{1,3}))?$/.exec(String(ref).trim());
  if (!m) throw new DataError(`Bad reference "${ref}" (use e.g. 2:255 or 94:5-6)`);
  const surah = Number(m[1]);
  const from = Number(m[2]);
  const to = m[3] ? Number(m[3]) : from;
  if (surah < 1 || surah > 114) throw new DataError(`${ref}: surah must be 1-114`);
  if (from < 1 || to < from) throw new DataError(`${ref}: invalid verse range`);
  if (to > AYAH_COUNTS[surah - 1]) throw new DataError(`${ref}: surah ${surah} has only ${AYAH_COUNTS[surah - 1]} verses`);
  if (to - from + 1 > MAX_RANGE) throw new DataError(`${ref}: at most ${MAX_RANGE} verses per entry`);
  // Tanzil's Arabic file puts the Bismillah in front of verse 1 of every surah except 1 and 9.
  if (from === 1 && surah !== 1 && surah !== 9) {
    throw new DataError(`${ref}: first verses carry the Bismillah in the Arabic file; choose a later verse`);
  }
  return { surah, from, to };
}

export function buildEntries(refs, src) {
  const seen = new Set();
  return refs.map(({ ref }) => {
    const { surah, from, to } = parseRef(ref);
    const verses = [];
    for (let n = from; n <= to; n++) {
      const key = `${surah}:${n}`;
      if (seen.has(key)) throw new DataError(`${key} appears in more than one entry`);
      seen.add(key);
      verses.push({ n, ar: src.ar.verses.get(key), en: src.en.verses.get(key), bn: src.bn.verses.get(key) });
    }
    return {
      id: to > from ? `${surah}:${from}-${to}` : `${surah}:${from}`,
      surah,
      surahName: SURAH_NAMES[surah - 1],
      from,
      to,
      verses
    };
  });
}

async function main() {
  let raw;
  try {
    raw = await Promise.all(
      Object.entries(SOURCES).map(async ([k, s]) => [k, await readFile(path.join(SRC_DIR, s.file), 'utf8')])
    );
  } catch (err) {
    if (err.code === 'ENOENT') {
      console.warn(`ayah data: skipped. Add the Tanzil files to ${path.relative(ROOT, SRC_DIR)}/ (see its README.md); the widget stays hidden until then.`);
      return;
    }
    throw err;
  }

  const src = {};
  for (const [k, text] of raw) src[k] = parseTanzil(text, SOURCES[k].file);

  const refs = JSON.parse(await readFile(REFS_PATH, 'utf8'));
  if (!Array.isArray(refs) || refs.length === 0) throw new DataError('ayah-refs.json must be a non-empty array');
  const entries = buildEntries(refs, src);

  for (const e of entries) {
    for (const v of e.verses) {
      for (const k of Object.keys(SOURCES)) {
        if (!SOURCES[k].script.test(v[k])) throw new DataError(`${e.id}: "${k}" text has the wrong script. Are the files swapped?`);
      }
    }
  }

  const out = {
    meta: {
      sources: Object.fromEntries(
        Object.entries(SOURCES).map(([k, s]) => [k, { tanzilId: s.tanzilId, label: s.label, notice: src[k].notice }])
      )
    },
    entries
  };
  await mkdir(path.dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(out));

  console.log(`ayah data: ${entries.length} entries written. Review list:`);
  for (const e of entries) {
    const label = e.to > e.from ? `${e.surah}:${e.from}-${e.to}` : `${e.surah}:${e.from}`;
    console.log(`  ${label.padEnd(9)} ${e.surahName.padEnd(14)} ${e.verses[0].en.slice(0, 70)}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`\nayah data: ${err.message}`);
    process.exit(1);
  });
}
