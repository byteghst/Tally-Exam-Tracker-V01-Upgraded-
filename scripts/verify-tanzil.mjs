// Fails the build if a Tanzil source file in data/tanzil/ differs from the
// SHA-256 recorded in data/tanzil/checksums.json (a changed or wrong file).
// With no checksums.json yet, it only prints the hashes so they can be recorded.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIR = process.env.AYAH_SRC_DIR || path.join(ROOT, 'data/tanzil');
const FILES = ['quran-uthmani.txt', 'en.sahih.txt', 'bn.bengali.txt'];

async function main() {
  const actual = {};
  for (const f of FILES) {
    try {
      actual[f] = createHash('sha256').update(await readFile(path.join(DIR, f))).digest('hex');
    } catch (err) {
      if (err.code === 'ENOENT') return; // files not added yet; the ayah build reports that
      throw err;
    }
  }

  let lock;
  try {
    lock = JSON.parse(await readFile(path.join(DIR, 'checksums.json'), 'utf8'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  if (!lock) {
    console.warn('tanzil checksums: no checksums.json yet. Current SHA-256 of the source files:');
    for (const f of FILES) console.warn(`  ${actual[f]}  ${f}`);
    return;
  }

  const bad = FILES.filter((f) => lock[f] !== actual[f]);
  if (bad.length > 0) {
    console.error('\ntanzil checksums: source files do not match data/tanzil/checksums.json:');
    for (const f of bad) console.error(`  ${f}\n    expected ${lock[f] ?? '(none)'}\n    found    ${actual[f]}`);
    console.error('If you replaced a file on purpose, verify it against tanzil.net and update checksums.json.');
    process.exit(1);
  }
  console.log('tanzil checksums: all source files match.');
}

main().catch((err) => {
  console.error(`\ntanzil checksums: ${err.message}`);
  process.exit(1);
});
