import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/** Shown at the top of the page while there is no connection. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="status" className="mb-4 flex items-start gap-2.5 rounded-control bg-saffron/15 px-3.5 py-2.5 text-sm text-ink">
      <WifiOff size={16} className="mt-0.5 shrink-0 text-saffron" aria-hidden />
      <p>
        You’re offline. Showing your last saved data. Study timer and settings keep working; exam, task and deadline
        edits need a connection.
      </p>
    </div>
  );
}
