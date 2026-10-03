import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Share2, Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { useUIStore } from '@/store/uiStore';
import { useExamStore } from '@/store/examStore';
import { useTaskStore } from '@/store/taskStore';
import { useStudyStore } from '@/store/studyStore';
import { computeMonthlyReport, earliestReportMonth } from '@/lib/monthlyReport';
import { drawMonthlyReport, REPORT_WIDTH } from '@/lib/shareCard/drawMonthlyReport';
import { prepareCardAssets } from '@/lib/shareCard/drawExamTrendCard';

interface MonthlyReportSheetProps {
  open: boolean;
  onClose: () => void;
}

/** Phones cap how large a canvas can be; stay safely under that for tall reports. */
const MAX_PIXELS = 9_000_000;

const monthIndex = (m: { year: number; month: number }) => m.year * 12 + m.month;

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // reader.result is a data: URL — strip the "data:...;base64," prefix
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image data'));
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
  const [busy, setBusy] = useState<'download' | 'share' | null>(null);
  const [canShareFiles, setCanShareFiles] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
        navigator.canShare?.({ files: [new File([], 'test.png', { type: 'image/png' })] }) === true
    );
  }, []);

  // Fonts and the logo must be ready before the first draw, or the report
  // would silently fall back to system fonts / miss the logo.
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

  // Draw: once on a scratch canvas to learn the height (it depends on the
  // data), then on the real canvas sized to fit.
  useEffect(() => {
    if (!open || !assetsReady || report.isEmpty) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const scratch = document.createElement('canvas').getContext('2d');
    if (!ctx || !scratch) return;

    const height = drawMonthlyReport(scratch, report, logoRef.current);
    const dpr = window.devicePixelRatio || 1;
    const scale = Math.max(0.75, Math.min(2, dpr, Math.sqrt(MAX_PIXELS / (REPORT_WIDTH * height))));
    canvas.width = Math.round(REPORT_WIDTH * scale);
    canvas.height = Math.round(height * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    drawMonthlyReport(ctx, report, logoRef.current, height);
  }, [open, assetsReady, report]);

  function getBlob(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) return reject(new Error('Report not ready'));
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not generate the image'));
      }, 'image/png');
    });
  }

  const fileName = `tally-report-${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}.png`;

  async function handleDownload() {
    setBusy('download');
    try {
      const blob = await getBlob();
      if (Capacitor.isNativePlatform()) {
        // A plain <a download> does nothing inside the Android app, so the file
        // is written to the phone's Documents folder instead.
        const base64 = await blobToBase64(blob);
        await Filesystem.writeFile({ path: fileName, data: base64, directory: Directory.Documents });
        pushToast('Saved to Documents on your device');
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
      pushToast("Couldn't save the report. Please try again.", undefined, 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleShare() {
    setBusy('share');
    try {
      const blob = await getBlob();
      const file = new File([blob], fileName, { type: 'image/png' });
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

  const disabled = busy !== null || !assetsReady || report.isEmpty;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Monthly report"
      footer={
        <div className="flex items-center justify-end gap-2">
          {busy && (
            <span className="mr-auto inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
              <Loader2 size={12} className="animate-spin" />
              {busy === 'share' ? 'Preparing to share…' : 'Saving…'}
            </span>
          )}
          <Button variant="secondary" onClick={handleDownload} disabled={disabled}>
            <Download size={16} />
            Download
          </Button>
          {canShareFiles && (
            <Button onClick={handleShare} disabled={disabled}>
              <Share2 size={16} />
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
        ) : !assetsReady ? (
          <p className="flex items-center gap-2 py-8 text-sm text-ink-muted">
            <Loader2 size={14} className="animate-spin" /> Preparing report…
          </p>
        ) : (
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: 'auto' }}
            aria-label={`Monthly report for ${report.label}`}
          />
        )}
      </div>
    </Sheet>
  );
}
