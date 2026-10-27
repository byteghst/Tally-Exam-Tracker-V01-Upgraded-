import { useEffect, useRef, useState } from 'react';
import { Download, Share2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Segmented } from '@/components/ui/Segmented';
import { useUIStore } from '@/store/uiStore';
import { useSettingsStore } from '@/store/settingsStore';
import type { Deadline } from '@/store/deadlineStore';
import { toISODate } from '@/lib/dates';
import { fileSlug } from '@/lib/deadlineFormat';
import { loadTallyLogo } from '@/lib/shareCard/drawExamTrendCard';
import { prepareCardFonts, cardSampleText } from '@/lib/shareCard/prepareFonts';
import {
  drawDeadlineCard,
  DEADLINE_CARD_WIDTH,
  DEADLINE_CARD_HEIGHT,
  type DeadlineCardData,
  type DeadlineCardTheme
} from '@/lib/shareCard/drawDeadlineCard';

interface DeadlineCardSheetProps {
  deadline: Deadline;
  onClose: () => void;
}

const ANIMATION_MS = 1500;

const THEME_OPTIONS = [
  { value: 'paper' as DeadlineCardTheme, label: 'Paper' },
  { value: 'ink' as DeadlineCardTheme, label: 'Ink' }
];

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read image data'));
    reader.readAsDataURL(blob);
  });
}

/**
 * The card for one deadline: how long is left, a timeline from the day it was
 * added to the day it is due, priority, title and notes. Bengali text is drawn
 * in Tiro Bangla. Saves a PNG to the device, or opens the share sheet when it can.
 */
export function DeadlineCardSheet({ deadline, onClose }: DeadlineCardSheetProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>();
  const logoRef = useRef<HTMLImageElement | null>(null);
  const readyRef = useRef(false);
  const [theme, setTheme] = useState<DeadlineCardTheme>('paper');
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [busyAction, setBusyAction] = useState<'download' | 'share' | null>(null);
  const { pushToast } = useUIStore();
  const userName = useSettingsStore((s) => s.settings.userName);
  const busy = busyAction !== null;

  const data: DeadlineCardData = {
    title: deadline.title,
    dueISO: deadline.dueDate,
    dueTime: deadline.dueTime,
    priority: deadline.priority,
    category: deadline.category,
    notes: deadline.notes,
    status: deadline.status,
    createdISO: toISODate(new Date(deadline.createdAt)),
    name: userName
  };
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

  // Reveal animation when the sheet opens.
  useEffect(() => {
    readyRef.current = false;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = DEADLINE_CARD_WIDTH * dpr;
    canvas.height = DEADLINE_CARD_HEIGHT * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    let cancelled = false;
    let start: number | null = null;

    async function run() {
      const d = dataRef.current;
      const sample = cardSampleText([d.title, d.notes ?? '', d.category ?? ''], d.name);
      const [logo] = await Promise.all([loadTallyLogo(), prepareCardFonts(sample)]);
      if (cancelled) return;
      logoRef.current = logo;

      const step = (timestamp: number) => {
        if (start === null) start = timestamp;
        const progress = (timestamp - start) / ANIMATION_MS;
        drawDeadlineCard(ctx!, dataRef.current, themeRef.current, logo, progress);
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
  }, []);

  // Switching Paper / Ink redraws the finished card straight away.
  useEffect(() => {
    if (!readyRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawDeadlineCard(ctx, dataRef.current, theme, logoRef.current, 1);
  }, [theme]);

  function fileName(): string {
    return `tally-deadline-${fileSlug(deadline.title)}-${deadline.dueDate}.png`;
  }

  function getFinalBlob(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = canvasRef.current;
      if (!canvas) return reject(new Error('Canvas not ready'));
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas not ready'));
      // always save the crisp, finished frame, wherever the animation is
      drawDeadlineCard(ctx, dataRef.current, themeRef.current, logoRef.current, 1);
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
      const filename = fileName();

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
      const file = new File([blob], fileName(), { type: 'image/png' });
      await navigator.share({ files: [file], title: deadline.title });
    } catch (err) {
      // AbortError just means the share sheet was closed, not a real failure
      if ((err as Error)?.name !== 'AbortError') {
        await handleDownload();
        return;
      }
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Deadline card"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" onClick={handleDownload} loading={busyAction === 'download'} disabled={busy}>
            {busyAction !== 'download' && <Download size={16} />}
            Download
          </Button>
          {canShareFiles && (
            <Button onClick={handleShare} loading={busyAction === 'share'} disabled={busy}>
              {busyAction !== 'share' && <Share2 size={16} />}
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
          style={{ aspectRatio: `${DEADLINE_CARD_WIDTH} / ${DEADLINE_CARD_HEIGHT}` }}
        >
          <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} aria-label="Deadline card" />
        </div>
      </div>
    </Sheet>
  );
}
