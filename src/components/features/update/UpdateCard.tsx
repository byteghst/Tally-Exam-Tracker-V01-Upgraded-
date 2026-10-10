import { Download, RefreshCw } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { useUpdateStore } from '@/store/updateStore';
import { canCheckForUpdates, INSTALLED_BUILD } from '@/lib/updateCheck';

/** Settings card: shows the installed build and lets you check for updates by hand. */
export function UpdateCard() {
  const phase = useUpdateStore((s) => s.phase);
  const update = useUpdateStore((s) => s.update);
  const check = useUpdateStore((s) => s.check);
  const openPrompt = useUpdateStore((s) => s.openPrompt);

  if (!canCheckForUpdates()) return null;

  const checking = phase === 'checking';

  let status = 'Tap the button to look for a newer version.';
  if (phase === 'checking') status = 'Checking…';
  else if (phase === 'current') status = "You're up to date.";
  else if (phase === 'error') status = "Couldn't check right now. Check your connection and try again.";
  else if (phase === 'available' && update) status = `Build ${update.build} is available.`;

  return (
    <GlassCard className="space-y-3 p-5">
      <h2 className="font-medium text-ink">App updates</h2>
      <p className="text-sm text-ink-muted">
        Installed: build {INSTALLED_BUILD}. {status}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={checking} onClick={() => void check({ manual: true })}>
          <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} /> Check for updates
        </Button>
        {phase === 'available' && update && (
          <Button size="sm" onClick={openPrompt}>
            <Download className="h-4 w-4" /> Get build {update.build}
          </Button>
        )}
      </div>
    </GlassCard>
  );
}
