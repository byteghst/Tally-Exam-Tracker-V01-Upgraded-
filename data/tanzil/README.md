# Tanzil source files

The Ayah of the day widget reads three **unmodified** files from [tanzil.net](https://tanzil.net). Add them here with exactly these names:

| File | Where to get it | Options |
| --- | --- | --- |
| `quran-uthmani.txt` | [tanzil.net/download](https://tanzil.net/download/) | Quran type: Uthmani. Output: Text (with verse numbers). Pause marks on, sajdah signs on, superscript alef on, rub-el-hizb signs off, tanween shapes default. |
| `en.sahih.txt` | [tanzil.net/trans](https://tanzil.net/trans/) | English, Saheeh International. Format: Text (with verse numbers). |
| `bn.bengali.txt` | [tanzil.net/trans](https://tanzil.net/trans/) | Bengali, Muhiuddin Khan. Format: Text (with verse numbers). |

Rules:

- Upload the files exactly as downloaded. Do not edit or re-save them; Tanzil's terms forbid changing the text and require the notice at the end of each file to stay.
- Each file must contain 6,236 verse lines (`surah|ayah|text`).
- The build validates this. Until all three files are present the widget stays hidden; if they are present but invalid, the build fails with the reason.

Verses shown are listed in `src/data/ayah-refs.json`.
