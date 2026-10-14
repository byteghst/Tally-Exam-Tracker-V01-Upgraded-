import { useEffect, useRef, useState } from 'react';
import { Download, Share2, Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { useUIStore } from '@/store/uiStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useStudyStore, elapsedMs } from '@/store/studyStore';
import { todayISO } from '@/lib/dates';
import { loadTallyLogo } from '@/lib/shareCard/drawExamTrendCard';
import {
  drawTaskCard,
  prepareTaskCardFonts,
  taskCardSampleText,
  TASK_CARD_WIDTH,
  TASK_CARD_HEIGHT,
  type TaskCardData,
  type TaskCardTheme
} from '@/lib/shareCard/drawTaskCard';
import type { Task } from '@/types';

interface ShareTaskCardProps {
  open: boolean;
  onClose: () => void;
  /** Today's tasks. */
  tasks: Task[];
}

const ANIMATION_MS = 1500;

const THEME_OPTIONS = [
  { value: 'paper' as TaskCardTheme, label: 'Paper' },
  { value: 'ink' as TaskCardTheme, label: 'Ink' }
];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // reader.result is a data: URL, strip the "data:...;base64," prefix
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image data'));
    reader.readAsDataURL(blob);
  });
}

/**
 * A picture of today's progress, made to be posted: Tally logo, big
 * "done / total" count, a progress bar, study time and the task list (Bengali
 * task names are drawn in Tiro Bangla). Saves a PNG to the device, or opens the
 * phone's share sheet when it can.
 */
export function ShareTaskCard({ open, onClose, tasks }: ShareTaskCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();
  const logoRef = useRef<HTMLImageElement | null>(null);
  const readyRef = useRef(false);
  const [theme, setTheme] = useState<TaskCardTheme>('paper');
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [busyAction, setBusyAction] = useState<'download' | 'share' | null>(null);
  const { pushToast } = useUIStore();
  const userName = useSettingsStore((s) => s.settings.userName);
  const sessions = useStudyStore((s) => s.sessions);
  const active = useStudyStore((s) => s.active);
  const busy = busyAction !== null;

  // Study time logged today, counting a timer that is running right now.
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const from = dayStart.getTime();
  let studyMs = sessions.filter((s) => s.end >= from).reduce((sum, s) => sum + s.durationMs, 0);
  if (active && active.sessionStart >= from) studyMs += elapsedMs(active);

  const data: TaskCardData = { dateISO: todayISO(), name: userName, tasks, studyMs };

  // The animation and the save buttons always use the newest data and theme.
  const dataRef = useRef(data);
  dataRef.current = data;
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    setCanShareFiles(
      typeof navigator !== 'undefined' &&
        'canShare' in navigator &&
        navigator.canShare?.({ files: [new File([], 'test.png', { type: 'image/png' })] }) === true
    );
  }, []);

  // Reveal animation each time the sheet opens.
  useEffect(() => {
    if (!open) {
      readyRef.current = false;
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = TASK_CARD_WIDTH * dpr;
    canvas.height = TASK_CARD_HEIGHT * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let cancelled = false;
    let start: number | null = null;

    async function run() {
      // fonts (including Tiro Bangla for Bengali task names) and the logo first
      const [logo] = await Promise.all([loadTallyLogo(), prepareTaskCardFonts(taskCardSampleText(dataRef.current))]);
      if (cancelled) return;
      logoRef.current = logo;

      const step = (timestamp: number) => {
        if (start === null) start = timestamp;
        const progress = (timestamp - start) / ANIMATION_MS;
        drawTaskCard(ctx!, dataRef.current, themeRef.current, logo, progress);
        if (progress < 1 && !cancelled) {
          rafRef.current = requestAnimationFrame(step);
        } else {
          readyRef.current = true;
        }
      };
      rafRef.current = requestAnimationFrame(step);
    }

    void run();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [open]);

  // Switching Paper / Ink redraws the finished card straight away.
  useEffect(() => {
    if (!open || !readyRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    drawTaskCard(ctx, dataRef.current, theme, logoRef.current, 1);
  }, [theme, open]);

  function getFinalBlob(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) return reject(new Error('Canvas not ready'));
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas not ready'));
      // always save the crisp, finished frame, wherever the animation is
      drawTaskCard(ctx, dataRef.current, themeRef.current, logoRef.current, 1);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not generate image'));
      }, 'image/png');
    });
  }

  async function handleDownload() {
    setBusyAction('download');
    try {
      const blob = await getFinalBlob();
      const filename = `tally-tasks-${dataRef.current.dateISO}.png`;

      if (Capacitor.isNativePlatform()) {
        // A plain <a download> click does nothing in a Capacitor WebView, so the
        // Filesystem plugin writes the file to the device instead.
        const base64 = await blobToBase64(blob);
        await Filesystem.writeFile({ path: filename, data: base64, directory: Directory.Documents });
        pushToast('Saved to Documents on your device');
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        // some mobile browsers only honour the click when the link is on the page
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        pushToast('Image downloaded');
      }
    } catch {
      pushToast("Couldn't save the image. Please try again.", undefined, 'error');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleShare() {
    setBusyAction('share');
    try {
      const blob = await getFinalBlob();
      const file = new File([blob], `tally-tasks-${dataRef.current.dateISO}.png`, { type: 'image/png' });
      await navigator.share({ files: [file], title: 'My day on Tally' });
    } catch (err) {
      // AbortError just means the share sheet was closed, not a real failure
      if ((err as Error)?.name !== 'AbortError') {
        // fall back to saving, so the image is not lost
        await handleDownload();
        return;
      }
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Share today"
      footer={
        <div className="flex items-center justify-end gap-2">
          {busy && (
            <span className="mr-auto inline-flex items-center gap-1.5 rounded-full bg-accent/15 px-3 py-1 text-xs font-medium text-accent">
              <Loader2 size={12} className="animate-spin" />
              {busyAction === 'share' ? 'Preparing…' : 'Saving…'}
            </span>
          )}
          <Button variant="secondary" onClick={handleDownload} disabled={busy}>
            <Download size={16} />
            Download
          </Button>
          {canShareFiles && (
            <Button onClick={handleShare} disabled={busy}>
              <Share2 size={16} />
              Share
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <Segmented options={THEME_OPTIONS} value={theme} onChange={setTheme} label="Card style" />
        <div
          className="mx-auto w-full max-w-sm border border-border"
          style={{ aspectRatio: `${TASK_CARD_WIDTH} / ${TASK_CARD_HEIGHT}` }}
        >
          <canvas
            ref={canvasRef}
            style={{ width: '100%', height: '100%' }}
            aria-label="Today's tasks, shareable card"
          />
        </div>
      </div>
    </Sheet>
  );
}
