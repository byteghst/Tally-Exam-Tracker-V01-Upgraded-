import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import { clsx } from 'clsx';
import { EASE_OUT } from '@/lib/motion';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Shared modal primitive for the app. Slides up as a bottom sheet on mobile
 * and rises into a centered dialog on desktop. Flat: a solid panel with a
 * hairline border over a dimmed backdrop, no blur and no shadow.
 */
export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    // focus the first focusable field for keyboard users
    const timer = setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>('input, select, textarea, button');
      first?.focus();
    }, 0);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      clearTimeout(timer);
    };
  }, [open, onClose]);

  const desktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center" role="presentation">
          <motion.div
            className="absolute inset-0 bg-ink/40"
            onClick={onClose}
            aria-hidden
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="sheet-title"
            initial={desktop ? { opacity: 0, y: 48 } : { y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={desktop ? { opacity: 0, y: 32 } : { y: '100%' }}
            transition={{ duration: 0.5, ease: EASE_OUT }}
            className={clsx(
              'relative flex w-full flex-col rounded-t-card border border-border bg-surface-raised',
              'max-h-[90vh] md:max-h-[85vh] md:w-full md:max-w-lg md:rounded-card',
              'pb-safe-bottom'
            )}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
              <h2 id="sheet-title" className="font-serif text-2xl leading-none tracking-tight text-ink">
                {title}
              </h2>
              <button
                onClick={onClose}
                aria-label="Close"
                className="rounded-control p-1.5 text-ink-muted hover:bg-ink/5 hover:text-ink"
              >
                <X size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>

            {footer && <div className="shrink-0 border-t border-border px-5 py-4">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
