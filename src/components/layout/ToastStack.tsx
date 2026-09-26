import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';
import { useUIStore, type Toast } from '@/store/uiStore';

const EXIT_MS = 200;

interface DisplayToast extends Toast {
  leaving?: boolean;
}

export function ToastStack() {
  const { toasts, dismissToast } = useUIStore();
  const [visible, setVisible] = useState<DisplayToast[]>([]);

  // Toasts are removed from the store instantly (both on auto-timeout and
  // manual Undo-click), but we want a brief exit transition rather than a
  // hard pop. So this component keeps its own shadow list: an id that
  // disappears from the store gets marked `leaving` here first, and is only
  // actually dropped from view ~200ms later.
  useEffect(() => {
    setVisible((prev) => {
      const storeIds = new Set(toasts.map((t) => t.id));
      const stillTracked = prev
        .filter((t) => storeIds.has(t.id) || t.leaving)
        .map((t) => (storeIds.has(t.id) ? t : { ...t, leaving: true }));
      const newlyAdded = toasts.filter((t) => !prev.some((p) => p.id === t.id));
      return [...stillTracked, ...newlyAdded];
    });
  }, [toasts]);

  useEffect(() => {
    if (!visible.some((t) => t.leaving)) return;
    const timer = setTimeout(() => {
      setVisible((prev) => prev.filter((t) => !t.leaving));
    }, EXIT_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  if (visible.length === 0) return null;

  return (
    <div className="fixed bottom-20 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4 md:bottom-6">
      {visible.map((toast) => {
        const Icon = toast.tone === 'error' ? AlertCircle : CheckCircle2;
        return (
          <div
            key={toast.id}
            role="status"
            className={`flex items-center gap-3 rounded-control border border-border bg-surface-raised px-4 py-3 shadow-glass transition-all duration-200 ${
              toast.leaving ? 'translate-y-1 opacity-0' : 'toast-enter translate-y-0 opacity-100'
            }`}
          >
            <Icon
              size={18}
              className={`shrink-0 ${toast.tone === 'error' ? 'text-danger' : 'text-success'}`}
            />
            <span className="flex-1 text-sm text-ink">{toast.message}</span>
            {toast.action && (
              <button
                onClick={() => {
                  toast.action?.onClick();
                  dismissToast(toast.id);
                }}
                className="shrink-0 text-sm font-semibold text-accent"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
