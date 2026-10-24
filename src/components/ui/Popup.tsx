import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { LucideIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from './Button';

export type PopupTone = 'accent' | 'danger' | 'forest' | 'saffron';

// Static class strings so Tailwind keeps them. `ring` is the colour of the one-off pulse behind the icon.
const TONES: Record<PopupTone, { tile: string; ring: string }> = {
  accent: { tile: 'bg-accent-soft text-accent', ring: 'rgb(var(--accent) / 0.35)' },
  danger: { tile: 'bg-danger/10 text-danger', ring: 'rgb(var(--danger) / 0.3)' },
  forest: { tile: 'bg-forest/10 text-forest', ring: 'rgb(var(--forest) / 0.3)' },
  saffron: { tile: 'bg-saffron/15 text-saffron', ring: 'rgb(var(--saffron) / 0.35)' }
};

/** How long the closing animation takes; the popup is removed from the page right after, on a timer. */
const EXIT_MS = 360;

const CSS = `
@keyframes pop-ring{0%{transform:scale(.85);opacity:.9}100%{transform:scale(2);opacity:0}}
.pop-ring{position:absolute;inset:0;border-radius:22px;background:var(--pop-ring);animation:pop-ring 1000ms .3s cubic-bezier(.2,.7,.2,1) 1 both;pointer-events:none}
@keyframes pop-rise{0%{transform:translateY(10px);opacity:0}100%{transform:none;opacity:1}}
.pop-rise{animation:pop-rise 520ms cubic-bezier(.16,1,.3,1) both}
`;

interface PopupFrameProps {
  open: boolean;
  /** Called by the backdrop and Escape. Leave out for a popup that can only be closed from inside. */
  onClose?: () => void;
  labelledBy: string;
  className?: string;
  children: ReactNode;
}

/**
 * The floating card behind every popup: a soft raised panel that lifts in over a
 * dimmed page, inset from the screen edges so it reads as an object rather than
 * a drawer. Like Sheet, it is always removed by a timer (never by waiting on an
 * animation library) and ignores touches while closing, so it can't block the app.
 */
export function PopupFrame({ open, onClose, labelledBy, className, children }: PopupFrameProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const [lingering, setLingering] = useState(false);
  const [shown, setShown] = useState(false);

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

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current?.();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open && !lingering) return null;
  const visible = shown && open;

  return createPortal(
    <div
      className="fixed inset-0 z-[75] flex items-center justify-center p-5"
      role="presentation"
      style={{ pointerEvents: open ? 'auto' : 'none' }}
    >
      <style>{CSS}</style>
      <div
        className={clsx('absolute inset-0 bg-ink/40 transition-opacity duration-300', visible ? 'opacity-100' : 'opacity-0')}
        onClick={() => onCloseRef.current?.()}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={clsx(
          'relative max-h-[88dvh] w-full max-w-sm overflow-y-auto rounded-[32px] bg-surface-raised shadow-raise',
          'transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
          visible ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-6 scale-95 opacity-0',
          className
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

interface PopupAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
}

interface PopupProps {
  open: boolean;
  onClose: () => void;
  icon: LucideIcon;
  tone?: PopupTone;
  /** Small spaced-out label above the title. */
  eyebrow?: string;
  title: string;
  children?: ReactNode;
  primary?: PopupAction & { variant?: 'primary' | 'danger' };
  secondary?: PopupAction;
  /** Quiet extra line (or link) under the buttons. */
  footnote?: ReactNode;
}

/**
 * Message popup: a toned icon tile that pulses once, an eyebrow, a serif title,
 * the message, then full-width stacked buttons. Used for confirmations, update
 * and download prompts.
 */
export function Popup({
  open,
  onClose,
  icon: Icon,
  tone = 'accent',
  eyebrow,
  title,
  children,
  primary,
  secondary,
  footnote
}: PopupProps) {
  return (
    <PopupFrame open={open} onClose={onClose} labelledBy="popup-title">
      <div className="px-6 pb-6 pt-7">
        <div
          className={clsx('pop-rise relative grid h-14 w-14 place-items-center rounded-[22px]', TONES[tone].tile)}
          style={{ '--pop-ring': TONES[tone].ring } as CSSProperties}
        >
          <span className="pop-ring" aria-hidden />
          <Icon size={26} strokeWidth={2} className="relative" />
        </div>

        {eyebrow && <p className="eyebrow pop-rise mt-5">{eyebrow}</p>}
        <h2
          id="popup-title"
          className="pop-rise mt-2 font-serif text-[2rem] leading-[1.05] tracking-tight text-ink"
          style={{ animationDelay: '60ms' }}
        >
          {title}
        </h2>

        {children && (
          <div className="pop-rise mt-3 text-sm leading-relaxed text-ink-muted" style={{ animationDelay: '120ms' }}>
            {children}
          </div>
        )}

        {(primary || secondary) && (
          <div className="pop-rise mt-6 flex flex-col gap-1.5" style={{ animationDelay: '180ms' }}>
            {primary && (
              <Button size="lg" variant={primary.variant ?? 'primary'} className="w-full" onClick={primary.onClick}>
                {primary.icon}
                {primary.label}
              </Button>
            )}
            {secondary && (
              <Button size="lg" variant="ghost" className="w-full text-ink-muted" onClick={secondary.onClick}>
                {secondary.icon}
                {secondary.label}
              </Button>
            )}
          </div>
        )}

        {footnote && <div className="mt-3 text-center text-xs text-ink-faint">{footnote}</div>}
      </div>
    </PopupFrame>
  );
}
