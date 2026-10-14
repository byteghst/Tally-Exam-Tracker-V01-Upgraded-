import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { clsx } from 'clsx';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

/** How long the closing slide takes; the sheet is removed from the page right after. */
const EXIT_MS = 520;

/**
 * Shared modal primitive for the app. Slides up as a bottom sheet on mobile
 * and rises into a centered dialog on desktop. Flat: a solid panel with a
 * hairline border over a dimmed backdrop, no blur and no shadow.
 *
 * The slide is plain CSS, and the sheet is always removed by a timer, never by
 * waiting on an animation library to report "finished". While it is closing it
 * ignores touches, so a closing (or stuck) sheet can never block the app.
 *
 * The contents are rendered in the very same render that `open` becomes true,
 * so anything inside (a canvas, an input) exists by the time the parent's
 * effects run.
 */
export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Always call the latest onClose without re-running the effects below
  // every time the parent re-renders.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // `lingering` keeps the sheet on the page while it slides out.
  const [lingering, setLingering] = useState(false);
  const [shown, setShown] = useState(false);

  // Slide in on the next frames; slide out, then remove on a timer.
  useEffect(() => {
    if (open) {
      setLingering(true);
      let inner = 0;
      const outer = requestAnimationFrame(() => {
        inner = requestAnimationFrame(() => setShown(true));
      });
      return () => {
        cancelAnimationFrame(outer);
        cancelAnimationFrame(inner);
      };
    }
    setShown(false);
    const timer = window.setTimeout(() => setLingering(false), EXIT_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  // Escape closes; the page behind does not scroll; focus lands on the first field once.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    const timer = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>('input, select, textarea, button');
      first?.focus();
    }, 50);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
      window.clearTimeout(timer);
    };
  }, [open]);

  if (!open && !lingering) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center md:items-center"
      role="presentation"
      style={{ pointerEvents: open ? 'auto' : 'none' }}
    >
      <div
        className={clsx(
          'absolute inset-0 bg-ink/40 transition-opacity duration-300',
          shown && open ? 'opacity-100' : 'opacity-0'
        )}
        onClick={() => onCloseRef.current()}
        aria-hidden
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        className={clsx(
          'relative flex w-full flex-col rounded-t-card border border-border bg-surface-raised',
          'max-h-[90vh] md:max-h-[85vh] md:w-full md:max-w-lg md:rounded-card',
          'pb-safe-bottom',
          'transition-[transform,opacity] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]',
          shown && open ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 md:translate-y-8'
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <h2 id="sheet-title" className="font-serif text-2xl leading-none tracking-tight text-ink">
            {title}
          </h2>
          <button
            onClick={() => onCloseRef.current()}
            aria-label="Close"
            className="rounded-control p-1.5 text-ink-muted hover:bg-ink/5 hover:text-ink"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>

        {footer && <div className="shrink-0 border-t border-border px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
