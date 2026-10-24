import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, Check } from 'lucide-react';
import { useUIStore, TOAST_DURATION_MS } from '@/store/uiStore';
import { EASE_OUT } from '@/lib/motion';

/** Four tally bars: one fades out in each quarter of the message's time on screen. */
const TALLY = [0, 1, 2, 3];

/**
 * Confirmation messages as inverted pills: dark ink with paper text on the light
 * theme, paper with ink text on the dark one. A round status mark (forest =
 * done, crimson = problem) leads, the message follows, and four small tally
 * bars on the right count the message away, one bar per quarter. They rise
 * into place above the navigation bar and sink away when dismissed.
 *
 * The stack itself ignores touches (only a message's own action button takes
 * them), so nothing here can ever sit on top of the app and block it.
 */
export function ToastStack() {
  const { toasts, dismissToast } = useUIStore();
  const seconds = TOAST_DURATION_MS / 1000;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] mx-auto flex w-full max-w-md flex-col items-center gap-2 px-4 md:bottom-6">
      <AnimatePresence initial={false}>
        {toasts.map((toast) => {
          const isError = toast.tone === 'error';
          return (
            <motion.div
              key={toast.id}
              layout
              role="status"
              initial={{ opacity: 0, y: 32, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 14, scale: 0.97 }}
              transition={{ duration: 0.5, ease: EASE_OUT }}
              className="flex w-full items-center gap-3 rounded-[26px] bg-ink py-2.5 pl-2.5 pr-4 text-surface shadow-raise"
            >
              <span
                aria-hidden
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-accent-on ${isError ? 'bg-danger' : 'bg-forest'}`}
              >
                {isError ? <AlertTriangle size={16} strokeWidth={2.4} /> : <Check size={17} strokeWidth={2.8} />}
              </span>

              <p className="min-w-0 flex-1 text-sm font-semibold leading-snug">{toast.message}</p>

              {toast.action && (
                <button
                  onClick={() => {
                    toast.action?.onClick();
                    dismissToast(toast.id);
                  }}
                  className="pointer-events-auto shrink-0 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-accent-on active:scale-95"
                >
                  {toast.action.label}
                </button>
              )}

              <span aria-hidden className="flex shrink-0 items-center gap-[3px]">
                {TALLY.map((i) => (
                  <motion.span
                    key={i}
                    className="h-3.5 w-[3px] rounded-full bg-surface"
                    initial={{ opacity: 0.9 }}
                    animate={{ opacity: 0.18 }}
                    transition={{ delay: seconds * ((i + 1) / TALLY.length) - 0.3, duration: 0.3 }}
                  />
                ))}
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
