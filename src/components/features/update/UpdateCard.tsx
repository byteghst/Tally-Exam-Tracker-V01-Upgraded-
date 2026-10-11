import { Download, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Section } from '@/components/motion/Reveal';
import { useUpdateStore } from '@/store/updateStore';
import { canCheckForUpdates, INSTALLED_BUILD } from '@/lib/updateCheck';

/** Settings section: shows the installed build and lets you check for updates by hand. */
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
    <Section label="App updates">
      <p className="font-serif text-4xl leading-none tracking-tight text-ink">Build {INSTALLED_BUILD}</p>
      <p className="mt-2 text-sm text-ink-muted">{status}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" disabled={checking} onClick={() => void check({ manual: true })}>
          <RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} /> Check for updates
        </Button>
        {phase === 'available' && update && (
          <Button size="sm" onClick={openPrompt}>
            <Download className="h-4 w-4" /> Get build {update.build}
          </Button>
        )}
      </div>
    </Section>
  );
}
