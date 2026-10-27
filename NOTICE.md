# Third-party data

The code in this repository is MIT licensed (see `LICENSE`). The Quran text and translations below are not, and keep their own terms.

## Quran text and translations

Source: [Tanzil Project](https://tanzil.net), used unmodified from `data/tanzil/`.

- Arabic: Tanzil Uthmani text.
- English: Saheeh International (`en.sahih`).
- Bengali: Muhiuddin Khan (`bn.bengali`).

The text and translations are used under Tanzil's terms: the source is credited in the app and linked to tanzil.net, the text is not altered, and the notice included in each source file is preserved. Translations are used for non-commercial purposes only.

The verses shown are selected in `src/data/ayah-refs.json`. Verse text is never typed or edited by hand; `scripts/build-ayah-data.mjs` copies it from the source files and fails the build if a file is incomplete or a reference is invalid.

## Font

Amiri Quran, SIL Open Font License 1.1, via `@fontsource/amiri-quran`.
