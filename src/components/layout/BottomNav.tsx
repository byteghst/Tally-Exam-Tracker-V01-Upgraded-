import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MoreHorizontal, X } from 'lucide-react';
import { clsx } from 'clsx';
import { NAV_ITEMS } from './navConfig';

export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const primary = NAV_ITEMS.filter((i) => i.primary);
  const secondary = NAV_ITEMS.filter((i) => !i.primary);

  const activeIndex = primary.findIndex(
    (item) => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
  );
  const slotCount = primary.length + 1; // + the "More" button

  return (
    <>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex md:hidden border-t border-border bg-surface/80 backdrop-blur-glass pb-safe-bottom"
        aria-label="Primary"
      >
        {activeIndex >= 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute top-1.5 h-1 rounded-full bg-accent transition-[left] duration-300 ease-out"
            style={{
              width: `calc(100% / ${slotCount} - 20px)`,
              left: `calc(${activeIndex} * (100% / ${slotCount}) + 10px)`
            }}
          />
        )}
        {primary.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              clsx(
                'flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors duration-200',
                isActive ? 'text-accent' : 'text-ink-muted'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={22} className={clsx('transition-transform duration-200', isActive && 'scale-110')} />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium text-ink-muted"
          aria-label="More"
        >
          <MoreHorizontal size={22} />
          More
        </button>
      </nav>

      {moreOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
          <div className="relative w-full rounded-t-card border-t border-border bg-surface-raised p-4 pb-safe-bottom">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-base font-semibold text-ink">More</span>
              <button onClick={() => setMoreOpen(false)} aria-label="Close">
                <X size={20} className="text-ink-muted" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3">
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
