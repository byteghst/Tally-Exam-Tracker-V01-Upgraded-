import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MoreHorizontal, X } from 'lucide-react';
import { clsx } from 'clsx';
import { NAV_ITEMS } from './navConfig';
import { EASE_OUT, spring } from '@/lib/motion';

export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = NAV_ITEMS.filter((i) => i.primary);
  const secondary = NAV_ITEMS.filter((i) => !i.primary);

  return (
    <>
      {/* Flat bar fixed to the bottom edge: a hairline on top, solid paper
          behind. The active tab gets an accent line that slides between tabs. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-safe-bottom md:hidden"
        aria-label="Primary"
      >
        <div className="mx-auto flex max-w-md items-stretch">
          {primary.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                clsx(
                  'relative flex flex-1 flex-col items-center gap-1 px-1 pb-1 pt-3 text-[11px] font-semibold tracking-tight transition-colors duration-200',
                  isActive ? 'text-ink' : 'text-ink-faint active:text-ink'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="bottom-nav-indicator"
                      transition={spring}
                      className="absolute inset-x-3 -top-px h-0.5 bg-accent"
                    />
                  )}
                  <item.icon size={21} strokeWidth={isActive ? 2.2 : 1.7} className={isActive ? 'text-accent' : ''} />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
          <button
            onClick={() => setMoreOpen(true)}
            className="flex flex-1 flex-col items-center gap-1 px-1 pb-1 pt-3 text-[11px] font-semibold tracking-tight text-ink-faint transition-colors duration-200 active:text-ink"
            aria-label="More"
          >
            <MoreHorizontal size={21} strokeWidth={1.7} />
            More
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {moreOpen && (
          <div className="fixed inset-0 z-50 flex items-end md:hidden" role="dialog" aria-modal="true">
            <motion.div
              className="absolute inset-0 bg-ink/40"
              onClick={() => setMoreOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            />
            <motion.div
              className="relative w-full rounded-t-card border-t border-border bg-surface-raised p-5 pb-safe-bottom"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ duration: 0.45, ease: EASE_OUT }}
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="font-serif text-2xl leading-none tracking-tight text-ink">More</span>
                <button onClick={() => setMoreOpen(false)} aria-label="Close">
                  <X size={20} className="text-ink-muted" />
                </button>
              </div>
              <div className="divide-y divide-border border-y border-border">
                {secondary.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={() => setMoreOpen(false)}
                    className="flex items-center gap-4 py-4 text-base font-medium text-ink transition-colors active:text-accent"
                  >
                    <item.icon size={20} className="text-ink-muted" />
                    {item.label}
                  </NavLink>
                ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
