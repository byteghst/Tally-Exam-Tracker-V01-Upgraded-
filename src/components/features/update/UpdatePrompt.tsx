import { useEffect } from 'react';
import { Download } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { useUpdateStore } from '@/store/updateStore';
import { canCheckForUpdates, openDownload, INSTALLED_BUILD } from '@/lib/updateCheck';

const MAX_NOTES_CHARS = 400;

/**
 * Mounted once in the app shell. Checks for a newer APK when the app opens and
 * whenever it comes back to the foreground (the check itself is throttled), and
 * shows a sheet when one is found.
 */
export function UpdatePrompt() {
  const update = useUpdateStore((s) => s.update);
  const promptOpen = useUpdateStore((s) => s.promptOpen);
  const check = useUpdateStore((s) => s.check);
  const closePrompt = useUpdateStore((s) => s.closePrompt);

  useEffect(() => {
    if (!canCheckForUpdates()) return;
    void check();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [check]);

  if (!update) return null;

  const notes =
    update.notes.length > MAX_NOTES_CHARS ? `${update.notes.slice(0, MAX_NOTES_CHARS).trimEnd()}…` : update.notes;

  return (
    <Sheet
      open={promptOpen}
      onClose={() => closePrompt(true)}
      title="Update available"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => closePrompt(true)}>
            Later
          </Button>
          <Button
            onClick={() => {
              openDownload();
              closePrompt(false);
            }}
          >
            <Download className="h-4 w-4" /> Download update
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-ink">
          A newer version of Tally is ready (build {update.build}). You're on build {INSTALLED_BUILD}.
        </p>
        {notes && <p className="whitespace-pre-line text-sm text-ink-muted">{notes}</p>}
        <p className="text-xs text-ink-faint">
          When the download finishes, open it and tap Install. Your exams and tasks are stored in your account, so
          nothing is lost. If Android asks, allow your browser to install apps.
        </p>
      </div>
    </Sheet>
  );
}
