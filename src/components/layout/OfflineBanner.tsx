import { RefreshCw, WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOutboxStore } from '@/lib/outbox';

/** Shown at the top of the page while offline, or while offline changes are still syncing. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const pending = useOutboxStore((s) => s.pending);
  if (online && pending === 0) return null;

  const waiting = pending === 1 ? '1 change waiting to sync.' : `${pending} changes waiting to sync.`;
  const Icon = online ? RefreshCw : WifiOff;

  return (
    <div role="status" className="mb-4 flex items-start gap-2.5 rounded-control bg-saffron/15 px-3.5 py-2.5 text-sm text-ink">
      <Icon size={16} className="mt-0.5 shrink-0 text-saffron" aria-hidden />
      <p>
        {online
          ? `Syncing your offline changes. ${waiting}`
          : `You’re offline. Showing your last saved data. Exam, task and deadline changes are saved on this device and sync when you reconnect. Exam configs need a connection.${
              pending > 0 ? ` ${waiting}` : ''
            }`}
      </p>
    </div>
  );
}
