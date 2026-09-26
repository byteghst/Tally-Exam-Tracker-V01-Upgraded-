import { useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '@/store/settingsStore';

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Animates from the previous displayed value to `value` whenever it
 * changes, rather than jumping. Skips the animation entirely when motion is
 * reduced/off in Settings — in that case it just returns the target value
 * immediately, same as a plain number would render.
 */
export function useCountUp(value: number, durationMs = 600, decimals = 0): number {
  const { settings } = useSettingsStore();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef<number>();

  useEffect(() => {
    if (settings.animationLevel !== 'full') {
      setDisplay(value);
      fromRef.current = value;
      return;
    }

    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    const start = performance.now();
    const factor = Math.pow(10, decimals);

    function step(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = easeOutCubic(t);
      const current = Math.round((from + (to - from) * eased) * factor) / factor;
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = to;
      }
    }
    rafRef.current = requestAnimationFrame(step);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs, decimals, settings.animationLevel]);

  return display;
}
