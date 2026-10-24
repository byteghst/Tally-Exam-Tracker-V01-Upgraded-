import { useEffect, useState } from 'react';
import { BellRing, Download, RefreshCw, Smartphone, UserCheck } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Popup } from '@/components/ui/Popup';
import { openDownload } from '@/lib/updateCheck';

const HIDE_UNTIL_KEY = 'tally.appPrompt.hideUntil';
const FOREVER = Number.MAX_SAFE_INTEGER;
const LATER_MS = 7 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 2_500;

const PERKS = [
  { icon: BellRing, text: 'Exam and prayer reminders, even when the app is closed' },
  { icon: RefreshCw, text: 'Updates right inside the app' },
  { icon: UserCheck, text: 'Same account and data as the website' }
];

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
    <Popup
      open={open}
      onClose={later}
      icon={Smartphone}
      tone="accent"
      eyebrow="Android app"
      title="Take Tally with you"
      primary={{
        label: 'Download app',
        icon: <Download className="h-4 w-4" />,
        onClick: () => {
          openDownload();
          never();
        }
      }}
      secondary={{ label: 'Maybe later', onClick: later }}
      footnote={
        <button type="button" onClick={never} className="font-semibold text-ink-muted underline">
          Don't ask again
        </button>
      }
    >
      <ul className="space-y-2.5">
        {PERKS.map((perk) => (
          <li key={perk.text} className="flex items-center gap-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink/[0.06] text-ink">
              <perk.icon size={15} />
            </span>
            <span className="text-sm text-ink">{perk.text}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-ink-faint">
        When the download finishes, open it and tap Install. If Android asks, allow your browser to install apps.
      </p>
    </Popup>
  );
}
