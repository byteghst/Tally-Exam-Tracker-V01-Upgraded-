import { useEffect, useRef } from 'react';
import { useSettingsStore } from '@/store/settingsStore';

const COLORS = ['#284EFE', '#3EBD7E', '#E0A93E', '#0F1216'];
const DURATION_MS = 2200;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
}

export function ConfettiBurst({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { settings } = useSettingsStore();

  useEffect(() => {
    // Motion off/reduced: skip the animation entirely, just fire the
    // callback immediately so the celebration (toast etc.) still happens.
    if (settings.animationLevel !== 'full') {
      const timer = setTimeout(onDone, 0);
      return () => clearTimeout(timer);
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const originX = width / 2;
    const originY = height * 0.3;
    const particles: Particle[] = Array.from({ length: 60 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 6;
      return {
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 5 + Math.random() * 5,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.3
      };
    });

    let rafId: number;
    const start = performance.now();

    function frame(now: number) {
      const elapsed = now - start;
      const t = elapsed / DURATION_MS;
      if (t >= 1) {
        onDone();
        return;
      }

      ctx!.clearRect(0, 0, width, height);
      for (const p of particles) {
        p.vy += 0.12; // gravity
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        ctx!.save();
        ctx!.globalAlpha = 1 - t;
        ctx!.translate(p.x, p.y);
        ctx!.rotate(p.rotation);
        ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx!.restore();
      }

      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (settings.animationLevel !== 'full') return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-[90]"
      style={{ width: '100vw', height: '100vh' }}
    />
  );
}
