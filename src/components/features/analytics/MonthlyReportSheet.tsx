import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Share2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { TallyLoader } from '@/components/ui/TallyLoader';
import { useUIStore } from '@/store/uiStore';
import { useExamStore } from '@/store/examStore';
import { useTaskStore } from '@/store/taskStore';
import { useStudyStore } from '@/store/studyStore';
import { computeMonthlyReport, earliestReportMonth } from '@/lib/monthlyReport';
import {
  layoutMonthlyReport,
  PAGE_WIDTH,
  PAGE_HEIGHT,
  type ReportLayout
} from '@/lib/shareCard/monthlyReportPages';
import { prepareCardAssets } from '@/lib/shareCard/drawExamTrendCard';
import { buildPdf, canvasToPdfPage, type PdfImagePage } from '@/lib/pdf/imagePdf';

interface MonthlyReportSheetProps {
  open: boolean;
  onClose: () => void;
}

/** On-screen preview resolution (the PDF itself is rendered at EXPORT_SCALE). */
const PREVIEW_SCALE = 0.7;
/** 1.5x of the 1080px-wide page = about 195 dpi on A4: sharp text, modest file size. */
const EXPORT_SCALE = 1.5;

const monthIndex = (m: { year: number; month: number }) => m.year * 12 + m.month;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // reader.result is a data: URL — strip the "data:...;base64," prefix
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file data'));
    reader.readAsDataURL(blob);
  });
}

export function MonthlyReportSheet({ open, onClose }: MonthlyReportSheetProps) {
  const exams = useExamStore((s) => s.exams);
  const tasks = useTaskStore((s) => s.tasks);
  const sessions = useStudyStore((s) => s.sessions);
  const subjects = useStudyStore((s) => s.subjects);
  const pushToast = useUIStore((s) => s.pushToast);

  const today = new Date();
  const current = { year: today.getFullYear(), month: today.getMonth() };
  const [cursor, setCursor] = useState(current);
  const [assetsReady, setAssetsReady] = useState(false);
  const [layout, setLayout] = useState<ReportLayout | null>(null);
  const [busy, setBusy] = useState<'download' | 'share' | null>(null);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const previewRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const logoRef = useRef<HTMLImageElement | null>(null);

  const earliest = useMemo(() => earliestReportMonth(exams, tasks, sessions), [exams, tasks, sessions]);
  const report = useMemo(
    () => computeMonthlyReport({ exams, tasks, sessions, subjects, year: cursor.year, month: cursor.month }),
    [exams, tasks, sessions, subjects, cursor]
  );

  const canPrev = monthIndex(cursor) > monthIndex(earliest);
  const canNext = monthIndex(cursor) < monthIndex(current);

  function shift(delta: number) {
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  }

  useEffect(() => {
    setCanShareFiles(
      typeof navigator !== 'undefined' &&
        'canShare' in navigator &&
        navigator.canShare?.({ files: [new File([], 'test.pdf', { type: 'application/pdf' })] }) === true
    );
  }, []);

  // Fonts and the logo must be ready before drawing, or the report would
  // silently fall back to system fonts / miss the logo.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    prepareCardAssets().then((logo) => {
      if (cancelled) return;
      logoRef.current = logo;
      setAssetsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Lay the report out across A4 pages.
  useEffect(() => {
    if (!open || !assetsReady || report.isEmpty) {
      setLayout(null);
      return;
    }
    const measure = document.createElement('canvas').getContext('2d');
    if (!measure) return;
    setLayout(layoutMonthlyReport(report, logoRef.current, measure));
  }, [open, assetsReady, report]);

  // Draw the on-screen page previews.
  useEffect(() => {
    if (!layout) return;
    for (let i = 0; i < layout.pageCount; i++) {
      const canvas = previewRefs.current[i];
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) continue;
      canvas.width = Math.round(PAGE_WIDTH * PREVIEW_SCALE);
      canvas.height = Math.round(PAGE_HEIGHT * PREVIEW_SCALE);
      ctx.setTransform(PREVIEW_SCALE, 0, 0, PREVIEW_SCALE, 0, 0);
      layout.drawPage(ctx, i);
    }
  }, [layout]);

  const fileName = `tally-report-${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}.pdf`;

  /** Renders every page at full quality, one at a time (keeps memory low), and packs them into a PDF. */
  async function buildReportPdf(): Promise<Blob> {
    if (!layout) throw new Error('Report not ready');
    const pages: PdfImagePage[] = [];
    for (let i = 0; i < layout.pageCount; i++) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(PAGE_WIDTH * EXPORT_SCALE);
      canvas.height = Math.round(PAGE_HEIGHT * EXPORT_SCALE);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not draw the report');
      ctx.setTransform(EXPORT_SCALE, 0, 0, EXPORT_SCALE, 0, 0);
      layout.drawPage(ctx, i);
      pages.push(await canvasToPdfPage(canvas));
      canvas.width = 0; // release the page's memory before drawing the next
      canvas.height = 0;
    }
    const bytes = buildPdf(pages, { title: `Tally Monthly Report - ${report.label}`, created: new Date() });
    return new Blob([bytes as unknown as BlobPart], { type: 'application/pdf' });
  }

  async function handleDownload() {
    setBusy('download');
    try {
      const blob = await buildReportPdf();
      if (Capacitor.isNativePlatform()) {
        // A plain <a download> does nothing inside the Android app, so the PDF is
        // written to the phone's Documents folder instead.
        const base64 = await blobToBase64(blob);
        await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Documents });
        pushToast(`Saved to Documents: ${fileName}`);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        pushToast('Report downloaded');
      }
    } catch {
      pushToast("Couldn't create the PDF. Please try again.", undefined, 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleShare() {
    setBusy('share');
    try {
      const blob = await buildReportPdf();
      const file = new File([blob], fileName, { type: 'application/pdf' });
      await navigator.share({ files: [file], title: `Tally report — ${report.label}` });
    } catch (err) {
      // AbortError just means the share sheet was closed, which isn't a failure
      if ((err as Error)?.name !== 'AbortError') {
        await handleDownload();
        return;
      }
    } finally {
      setBusy(null);
    }
  }

  const disabled = busy !== null || !layout;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Monthly report"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button onClick={handleDownload} loading={busy === 'download'} disabled={disabled}>
            {busy !== 'download' && <Download size={16} />}
            Download PDF
          </Button>
          {canShareFiles && (
            <Button variant="secondary" onClick={handleShare} loading={busy === 'share'} disabled={disabled}>
              {busy !== 'share' && <Share2 size={16} />}
              Share
            </Button>
          )}
        </div>
      }
    >
      <div className="mx-auto w-full max-w-sm space-y-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => shift(-1)}
            disabled={!canPrev}
            aria-label="Previous month"
            className="rounded-control p-2 text-ink-muted hover:bg-white/5 hover:text-ink disabled:opacity-30"
          >
            <ChevronLeft size={20} />
          </button>
          <p className="font-display text-lg font-semibold text-ink">{report.label}</p>
          <button
            onClick={() => shift(1)}
            disabled={!canNext}
            aria-label="Next month"
            className="rounded-control p-2 text-ink-muted hover:bg-white/5 hover:text-ink disabled:opacity-30"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {report.isEmpty ? (
          <p className="rounded-control border border-border p-4 text-sm text-ink-muted">
            Nothing recorded in {report.label} yet. Use the arrows to pick a month with exams, tasks or study time.
          </p>
        ) : !layout ? (
          <div className="flex justify-center py-10">
            <TallyLoader size={84} label="Preparing report" />
          </div>
        ) : (
          <>
            <p className="text-xs text-ink-faint">
              A4 PDF · {layout.pageCount} page{layout.pageCount === 1 ? '' : 's'} · every exam and subject included
            </p>
            <div className="space-y-4">
              {Array.from({ length: layout.pageCount }, (_, i) => (
                <div key={i} className="overflow-hidden rounded-control border border-border shadow-glass">
                  <canvas
                    ref={(el) => {
                      previewRefs.current[i] = el;
                    }}
                    style={{ width: '100%', height: 'auto', display: 'block' }}
                    aria-label={`Report page ${i + 1} of ${layout.pageCount}`}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
