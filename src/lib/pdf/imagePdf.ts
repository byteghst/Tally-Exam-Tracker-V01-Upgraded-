/**
 * Minimal PDF writer: one full-bleed image per A4 page. No library needed.
 *
 * Each page of the report is drawn on a canvas with the app's real fonts and
 * brand design; this packs those pages into a standard PDF (page separations
 * included) that opens in any viewer, prints at A4, and can be shared.
 */

export interface PdfImagePage {
  /** image size in pixels */
  width: number;
  height: number;
  /** encoded image: zlib-compressed RGB bytes, or a JPEG file */
  data: Uint8Array;
  filter: 'FlateDecode' | 'DCTDecode';
}

export interface PdfInfo {
  title: string;
  author?: string;
  created?: Date;
}

/** A4 portrait in PDF points (1/72 inch). */
const PAGE_W = 595.28;
const PAGE_H = 841.89;

/** Escapes text for a PDF literal string, keeping it plain ASCII. */
function pdfString(text: string): string {
  return text
    .replace(/[^\x20-\x7E]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function pdfDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `D:${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

export function buildPdf(pages: PdfImagePage[], info: PdfInfo): Uint8Array {
  if (pages.length === 0) throw new Error('A PDF needs at least one page');

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;

  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    chunks.push(bytes);
    length += bytes.length;
  };
  const begin = (n: number) => {
    offsets[n] = length;
    push(`${n} 0 obj\n`);
  };
  const end = () => push('endobj\n');

  // Object numbers: 1 catalog, 2 page tree, 3 info, then 3 per page (page, content, image).
  const pageObj = (i: number) => 4 + i * 3;
  const contentObj = (i: number) => 5 + i * 3;
  const imageObj = (i: number) => 6 + i * 3;
  const objectCount = 3 + pages.length * 3;

  push('%PDF-1.4\n');
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a])); // binary marker comment

  begin(1);
  push('<< /Type /Catalog /Pages 2 0 R >>\n');
  end();

  begin(2);
  push(`<< /Type /Pages /Kids [${pages.map((_, i) => `${pageObj(i)} 0 R`).join(' ')}] /Count ${pages.length} >>\n`);
  end();

  begin(3);
  push(
    `<< /Title (${pdfString(info.title)}) /Author (${pdfString(info.author ?? 'Tally')}) /Producer (Tally) /CreationDate (${pdfDate(info.created ?? new Date())}) >>\n`
  );
  end();

  pages.forEach((page, i) => {
    begin(pageObj(i));
    push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /ProcSet [/PDF /ImageC] /XObject << /Im0 ${imageObj(i)} 0 R >> >> /Contents ${contentObj(i)} 0 R >>\n`
    );
    end();

    const content = `q\n${PAGE_W} 0 0 ${PAGE_H} 0 0 cm\n/Im0 Do\nQ\n`;
    begin(contentObj(i));
    push(`<< /Length ${encoder.encode(content).length} >>\nstream\n`);
    push(content);
    push('endstream\n');
    end();

    begin(imageObj(i));
    push(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${page.filter} /Length ${page.data.length} >>\nstream\n`
    );
    push(page.data);
    push('\nendstream\n');
    end();
  });

  const xrefOffset = length;
  push(`xref\n0 ${objectCount + 1}\n`);
  push('0000000000 65535 f \n');
  for (let n = 1; n <= objectCount; n++) {
    push(`${String(offsets[n]).padStart(10, '0')} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${objectCount + 1} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

/** zlib-compresses bytes (what PDF's FlateDecode expects) using the browser's built-in compressor. */
export async function deflate(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as unknown as BlobPart]).stream().pipeThrough(new CompressionStream('deflate'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/**
 * Turns a drawn canvas into a PDF page image. Lossless (compressed raw RGB)
 * when the browser can compress, otherwise a high-quality JPEG.
 */
export async function canvasToPdfPage(canvas: HTMLCanvasElement): Promise<PdfImagePage> {
  const { width, height } = canvas;
  const ctx = canvas.getContext('2d');
  if (ctx && typeof CompressionStream !== 'undefined') {
    const rgba = ctx.getImageData(0, 0, width, height).data;
    const rgb = new Uint8Array(width * height * 3);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
      rgb[j] = rgba[i];
      rgb[j + 1] = rgba[i + 1];
      rgb[j + 2] = rgba[i + 2];
    }
    return { width, height, data: await deflate(rgb), filter: 'FlateDecode' };
  }
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.95));
  if (!blob) throw new Error('Could not encode the page image');
  return { width, height, data: new Uint8Array(await blob.arrayBuffer()), filter: 'DCTDecode' };
}
