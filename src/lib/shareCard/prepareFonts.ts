// Font loading shared by the canvas share cards. Canvas text does not load web
// fonts by itself, so they are loaded explicitly before the first frame.

const FONT_SERIF = "'Instrument Serif', 'Tiro Bangla', Georgia, serif";
const FONT_UI = "'Plus Jakarta Sans', 'Tiro Bangla', system-ui, sans-serif";
const FONT_NUMERIC = "'Space Grotesk', 'Tiro Bangla', system-ui, sans-serif";

// A handful of Bengali letters and digits, so the Bengali part of Tiro Bangla
// (fetched only when Bengali text is used) is always loaded before drawing.
const BENGALI_SAMPLE = 'অআইঈউঊএঐওঔকখগঘচছজঝটঠডঢণতথদধনপফবভমযরলশষসহ০১২৩৪৫৬৭৮৯ািীুূেৈোৌ';

/** Every piece of text a card can draw, used to make sure the right font files are loaded. */
export function cardSampleText(names: string[], userName?: string): string {
  return [userName ?? '', ...names, BENGALI_SAMPLE, 'Today Tally 0123456789'].join(' ');
}

export async function prepareCardFonts(sample: string): Promise<void> {
  if (typeof document === 'undefined' || !('fonts' in document)) return;
  try {
    const specs = [
      `400 120px ${FONT_SERIF}`,
      `italic 400 40px ${FONT_SERIF}`,
      `600 22px ${FONT_UI}`,
      `500 34px ${FONT_UI}`,
      `600 28px ${FONT_NUMERIC}`,
      `700 40px ${FONT_NUMERIC}`,
      `400 34px 'Tiro Bangla'`,
      `italic 400 34px 'Tiro Bangla'`
    ];
    await Promise.all(specs.map((spec) => document.fonts.load(spec, sample)));
    await document.fonts.ready;
  } catch {
    // draw with whatever is loaded: a fallback font beats no card
  }
}
