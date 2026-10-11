/**
 * Colours for things the user picks or that are shown as data (study
 * subjects, chart series). All warm: persimmon, saffron, forest, olive, rose,
 * clay, sage and stone. There is no blue or purple anywhere in Tally.
 */
export const SUBJECT_COLORS = [
  '#D94F2D', // persimmon
  '#C98B12', // saffron
  '#2F7D5B', // forest
  '#7C8B2D', // olive
  '#C9486B', // rose
  '#A8613A', // clay
  '#5FA98A', // sage
  '#7A7165' // stone
] as const;

function hash(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Subjects saved before the palette change may carry the old blue, violet or
 * teal colours. Any stored colour that is not in the new palette is mapped to
 * one of the new colours (always the same one for the same old colour), so
 * existing subjects switch over without the user editing anything.
 */
export function toneColor(stored: string | undefined): string {
  if (!stored) return SUBJECT_COLORS[0];
  const upper = stored.toUpperCase();
  const known = SUBJECT_COLORS.find((c) => c === upper);
  if (known) return known;
  return SUBJECT_COLORS[hash(upper) % SUBJECT_COLORS.length];
}
