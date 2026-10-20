import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { openDownload } from '@/lib/updateCheck';

const HIDE_UNTIL_KEY = 'tally.appPrompt.hideUntil';
const FOREVER = Number.MAX_SAFE_INTEGER;
const LATER_MS = 7 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 2_500;

function hiddenUntil(): number {
  try {
    const n = Number(localStorage.getItem(HIDE_UNTIL_KEY));
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

function hideUntil(ts: number): void {
  try {
    localStorage.setItem(HIDE_UNTIL_KEY, String(ts));
  } catch {
    // storage unavailable: the popup just shows again next visit
  }
}

/**
 * Website only: offers the Android app to visitors on an Android phone. It is
 * never shown inside the app itself. "Later" hides it for a week; downloading
 * (or "Don't ask again") hides it for good.
 */
export function AppDownloadPrompt() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;
    if (!/android/i.test(navigator.userAgent)) return;
    if (Date.now() < hiddenUntil()) return;
    const id = window.setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(id);
  }, []);

  function later() {
    hideUntil(Date.now() + LATER_MS);
    setOpen(false);
  }

  function never() {
    hideUntil(FOREVER);
    setOpen(false);
  }

  return (
    <Sheet
      open={open}
      onClose={later}
      title="Get the Tally app"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={later}>
            Later
          </Button>
          <Button
            onClick={() => {
              openDownload();
              never();
            }}
          >
            <Download className="h-4 w-4" /> Download app
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-ink">
          Install Tally on your Android phone for prayer and exam reminders that arrive even when the app is closed, plus
          in-app updates.
        </p>
        <p className="text-xs text-ink-faint">
          When the download finishes, open it and tap Install. If Android asks, allow your browser to install apps. Your
          account and data are the same as on the website.
        </p>
        <button type="button" onClick={never} className="text-xs font-semibold text-ink-muted underline">
          Don't ask again
        </button>
      </div>
    </Sheet>
  );
}
