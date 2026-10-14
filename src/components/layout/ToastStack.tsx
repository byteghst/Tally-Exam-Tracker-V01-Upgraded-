import { AnimatePresence, motion } from 'framer-motion';
import { useUIStore, TOAST_DURATION_MS } from '@/store/uiStore';
import { EASE_OUT } from '@/lib/motion';

/**
 * Confirmation messages, in the app's own voice: a flat paper strip with a thin
 * coloured edge (forest = done, crimson = problem), the message in serif, and a
 * hairline that drains while the message is on screen. They slide up into place
 * above the navigation bar and slide away when dismissed.
 *
 * The stack itself ignores touches (only a message's own Undo button takes
 * them), so nothing here can ever sit on top of the app and block it.
 */
export function ToastStack() {
  const { toasts, dismissToast } = useUIStore();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] mx-auto flex w-full max-w-md flex-col gap-2 px-4 md:bottom-6">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const isError = toast.tone === 'error';
          return (
            <motion.div
              key={toast.id}
              layout
              role="status"
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.45, ease: EASE_OUT }}
              className="relative flex items-center gap-4 overflow-hidden rounded-control border border-border bg-surface-raised py-3.5 pl-5 pr-4"
            >
              <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${isError ? 'bg-danger' : 'bg-forest'}`} />

              <p className="min-w-0 flex-1 font-serif text-xl leading-snug text-ink">{toast.message}</p>

              {toast.action && (
                <button
                  onClick={() => {
                    toast.action?.onClick();
                    dismissToast(toast.id);
                  }}
                  className="pointer-events-auto shrink-0 text-xs font-semibold uppercase tracking-[0.16em] text-accent"
                >
                  {toast.action.label}
                </button>
              )}

              <motion.span
                aria-hidden
                className="absolute bottom-0 left-0 h-0.5 bg-ink/15"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: TOAST_DURATION_MS / 1000, ease: 'linear' }}
              />
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
