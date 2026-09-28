import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { MoreHorizontal, X } from 'lucide-react';
import { clsx } from 'clsx';
import { NAV_ITEMS } from './navConfig';

export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = NAV_ITEMS.filter((i) => i.primary);
  const secondary = NAV_ITEMS.filter((i) => !i.primary);

  return (
    <>
      {/* Floating glass dock. The active tab is a soft pill behind the icon +
          label (no indicator bar), and the dock sits inset from the screen
          edges instead of running edge to edge with a hard top border. */}
      <nav
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-safe-bottom md:hidden"
        aria-label="Primary"
      >
        <div className="glass-edge pointer-events-auto flex w-full max-w-md items-center gap-1 rounded-full border border-border/60 bg-surface-raised/[var(--glass-alpha)] p-1.5 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_14px_36px_-14px_rgb(0_0_0/0.3),inset_0_1px_0_rgb(255_255_255/var(--glass-hi-a))] backdrop-blur-glass">
          {primary.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                clsx(
                  'flex flex-1 flex-col items-center gap-0.5 rounded-full px-1 py-2 text-[11px] font-semibold tracking-tight transition-colors duration-200',
                  isActive ? 'bg-accent/12 text-accent' : 'text-ink-muted active:bg-white/5'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={21} strokeWidth={isActive ? 2.3 : 1.9} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center gap-0.5 rounded-full px-1 py-2 text-[11px] font-semibold tracking-tight text-ink-muted transition-colors duration-200 active:bg-white/5"
            aria-label="More"
          >
            <MoreHorizontal size={21} strokeWidth={1.9} />
            More
          </button>
        </div>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setMoreOpen(false)} />
          <div className="relative w-full rounded-t-card border-t border-border bg-surface-raised p-4 pb-safe-bottom">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-base font-semibold text-ink">More</span>
              <button onClick={() => setMoreOpen(false)} aria-label="Close">
                <X size={20} className="text-ink-muted" />
              </button>
            </div>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-3">
              {secondary.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setMoreOpen(false)}
                  className="flex flex-col items-center gap-2 rounded-control py-3 text-xs font-medium text-ink-muted transition-colors hover:bg-white/5 active:scale-95"
                >
                  <item.icon size={22} />
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
