import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Switch } from '@/components/ui/Switch';
import { ProgressBar } from '@/components/ui/Progress';
import { useAccent } from '@/hooks/useAccent';
import {
  contrastRatio,
  getEffectiveAccentHex,
  hexToRgb,
  hsvToRgb,
  normalizeHex,
  rgbToHex,
  rgbToHsv,
  type Hsv
} from '@/lib/accent';

const HUE_GRADIENT =
  'linear-gradient(to right,#f00 0%,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,#f00 100%)';

/** Pointer + keyboard control over a 0..1 position inside a box. */
function useDrag(onMove: (x: number, y: number) => void, onEnd: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const update = (e: PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    onMove(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
  };
  return {
    ref,
    handlers: {
      onPointerDown: (e: PointerEvent) => {
        dragging.current = true;
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        update(e);
      },
      onPointerMove: (e: PointerEvent) => dragging.current && update(e),
      onPointerUp: () => {
        if (!dragging.current) return;
        dragging.current = false;
        onEnd();
      }
    }
  };
}

/**
 * Accent colour picker: a saturation/brightness square, a hue bar and a HEX
 * field. Any colour is accepted. Changes apply live across the whole app.
 */
export function AccentPicker({ onCommit }: { onCommit?: () => void }) {
  const { accent, isDefault, setAccent, resetAccent } = useAccent();
  const effective = accent ?? getEffectiveAccentHex();
  const [hsv, setHsv] = useState<Hsv>(() => rgbToHsv(hexToRgb(effective)));
  const [text, setText] = useState(effective);
  const fromText = useRef(false);

  // follow outside changes (reset, other tab); keep hue when the colour is grey/black
  useEffect(() => {
    if (fromText.current) {
      fromText.current = false;
      return;
    }
    setHsv((prev) => {
      const next = rgbToHsv(hexToRgb(effective));
      return next.s === 0 || next.v === 0 ? { ...next, h: prev.h } : next;
    });
    setText(effective);
  }, [effective]);

  const push = useCallback(
    (next: Hsv, animate: boolean) => {
      setHsv(next);
      const hex = rgbToHex(hsvToRgb(next));
      setText(hex);
      fromText.current = false;
      setAccent(hex, { animate });
    },
    [setAccent]
  );

  const sv = useDrag(
    (x, y) => push({ ...hsv, s: x, v: 1 - y }, false),
    () => onCommit?.()
  );
  const hue = useDrag(
    (x) => push({ ...hsv, h: x * 360 }, false),
    () => onCommit?.()
  );

  function key(e: KeyboardEvent, apply: (dx: number, dy: number) => void) {
    const step = e.shiftKey ? 0.1 : 0.02;
    const d: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step]
    };
    if (!d[e.key]) return;
    e.preventDefault();
    apply(...d[e.key]);
    onCommit?.();
  }

  function onText(value: string) {
    setText(value);
    const hex = normalizeHex(value);
    if (!hex) return; // keep typing; nothing is rejected, it just isn't applied yet
    fromText.current = true;
    const next = rgbToHsv(hexToRgb(hex));
    setHsv((prev) => (next.s === 0 || next.v === 0 ? { ...next, h: prev.h } : next));
    setAccent(hex);
    onCommit?.();
  }

  const pure = rgbToHex(hsvToRgb({ h: hsv.h, s: 1, v: 1 }));
  const valid = normalizeHex(text) !== null;
  // subtle, non-blocking hint: how much the colour stands out from the page
  const pageBg = document.documentElement.classList.contains('dark') ? hexToRgb('#100E0C') : hexToRgb('#F0EADE');
  const low = contrastRatio(hexToRgb(effective), pageBg) < 1.5;

  return (
    <div className="space-y-4">
      <div
        ref={sv.ref}
        {...sv.handlers}
        role="slider"
        tabIndex={0}
        aria-label="Saturation and brightness"
        aria-valuetext={`Saturation ${Math.round(hsv.s * 100)}%, brightness ${Math.round(hsv.v * 100)}%`}
        aria-valuenow={Math.round(hsv.s * 100)}
        onKeyDown={(e) => key(e, (dx, dy) => push({ ...hsv, s: Math.min(1, Math.max(0, hsv.s + dx)), v: Math.min(1, Math.max(0, hsv.v - dy)) }, true))}
        className="relative h-44 w-full cursor-crosshair touch-none rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        style={{ backgroundColor: pure, backgroundImage: 'linear-gradient(to top,#000,transparent),linear-gradient(to right,#fff,transparent)' }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.45)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, backgroundColor: rgbToHex(hsvToRgb(hsv)) }}
        />
      </div>

      <div
        ref={hue.ref}
        {...hue.handlers}
        role="slider"
        tabIndex={0}
        aria-label="Hue"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        onKeyDown={(e) => key(e, (dx) => push({ ...hsv, h: (hsv.h + dx * 360 + 360) % 360 }, true))}
        className="relative h-4 w-full touch-none rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface"
        style={{ backgroundImage: HUE_GRADIENT }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.45)]"
          style={{ left: `${(hsv.h / 360) * 100}%`, backgroundColor: pure }}
        />
      </div>

      <div className="flex items-end gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1.5">
          <span className="eyebrow">HEX</span>
          <input
            value={text}
            onChange={(e) => onText(e.target.value)}
            onBlur={() => setText(effective)}
            spellCheck={false}
            autoCapitalize="characters"
            autoCorrect="off"
            maxLength={9}
            inputMode="text"
            aria-invalid={!valid}
            placeholder="#RRGGBB"
            className="h-12 rounded-control border-0 bg-ink/[0.05] px-4 font-numeric text-base uppercase text-ink transition-[background-color,box-shadow] duration-200 placeholder:text-ink-faint/70 focus-visible:bg-ink/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          />
        </label>
        <Button
          variant="secondary"
          onClick={() => {
            resetAccent();
            onCommit?.();
          }}
          disabled={isDefault}
        >
          <RotateCcw className="h-4 w-4" /> Reset to default
        </Button>
      </div>
      {!valid && <p className="-mt-2 text-xs text-ink-faint">Type a hex colour like #F80 or #D94F2D.</p>}
      {low && (
        <p className="-mt-2 text-xs text-ink-faint" aria-live="polite">
          This colour is close to the background, so it may blend in. Text and icons adjust automatically.
        </p>
      )}

      <div className="rounded-control bg-ink/[0.04] p-4" aria-label="Live preview">
        <p className="eyebrow">Preview</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button size="sm">Button</Button>
          <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold text-accent">Badge</span>
          <span className="text-sm font-semibold text-accent underline">Link</span>
          <PreviewSwitch />
        </div>
        <ProgressBar value={65} className="mt-4" />
      </div>
    </div>
  );
}

function PreviewSwitch() {
  const [on, setOn] = useState(true);
  return <Switch checked={on} onChange={setOn} label="Preview switch" />;
}
