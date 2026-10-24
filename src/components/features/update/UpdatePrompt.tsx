import { useEffect } from 'react';
import { ArrowRight, Download, Sparkles } from 'lucide-react';
import { Popup } from '@/components/ui/Popup';
import { useUpdateStore } from '@/store/updateStore';
import { canCheckForUpdates, openDownload, INSTALLED_BUILD } from '@/lib/updateCheck';

const MAX_NOTES_CHARS = 400;

/**
 * Mounted once in the app shell. Checks for a newer APK when the app opens and
 * whenever it comes back to the foreground (the check itself is throttled), and
 * shows a popup when one is found.
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
    <Popup
      open={promptOpen}
      onClose={() => closePrompt(true)}
      icon={Sparkles}
      tone="accent"
      eyebrow="Update available"
      title="A newer Tally is ready"
      primary={{
        label: 'Download update',
        icon: <Download className="h-4 w-4" />,
        onClick: () => {
          openDownload();
          closePrompt(false);
        }
      }}
      secondary={{ label: 'Maybe later', onClick: () => closePrompt(true) }}
      footnote="When the download finishes, open it and tap Install. Your exams and tasks live in your account, so nothing is lost. If Android asks, allow your browser to install apps."
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="tabular-nums rounded-full bg-ink/[0.07] px-3 py-1 text-xs font-semibold text-ink-muted">
            Build {INSTALLED_BUILD}
          </span>
          <ArrowRight size={14} className="text-ink-faint" aria-hidden />
          <span className="tabular-nums rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-on">
            Build {update.build}
          </span>
        </div>
        {notes && <p className="whitespace-pre-line rounded-control bg-ink/[0.04] p-3 text-sm text-ink-muted">{notes}</p>}
      </div>
    </Popup>
  );
}
