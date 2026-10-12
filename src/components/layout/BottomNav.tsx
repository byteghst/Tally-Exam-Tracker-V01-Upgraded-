import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { MoreHorizontal } from 'lucide-react';
import { clsx } from 'clsx';
import { NAV_ITEMS } from './navConfig';
import { EASE_OUT, spring } from '@/lib/motion';

export function BottomNav() {
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = NAV_ITEMS.filter((i) => i.primary);
  const secondary = NAV_ITEMS.filter((i) => !i.primary);

  useEffect(() => {
    if (!moreOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [moreOpen]);

  return (
    <>
      {/* Tapping anywhere outside the open bar closes it. */}
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            key="more-scrim"
            className="fixed inset-0 z-30 bg-ink/25 md:hidden"
            onClick={() => setMoreOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
      </AnimatePresence>

      {/* Flat bar fixed to the bottom edge: a hairline on top, solid paper
          behind. The active tab gets an accent line that slides between tabs. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface pb-safe-bottom md:hidden"
        aria-label="Primary"
      >
        {/* "More" grows upward out of the bar itself. Each row starts at the
            left edge: icon first, then the name. */}
        <AnimatePresence initial={false}>
          {moreOpen && (
            <motion.div
              key="more-bar"
              id="more-bar"
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              transition={{ duration: 0.45, ease: EASE_OUT }}
              className="absolute inset-x-0 bottom-full overflow-hidden border-t border-border bg-surface"
            >
              <ul className="divide-y divide-border">
                {secondary.map((item, i) => (
                  <motion.li
                    key={item.path}
                    initial={{ opacity: 0, x: -18 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: 0.1 + i * 0.06, duration: 0.4, ease: EASE_OUT }}
                  >
                    <NavLink
                      to={item.path}
                      onClick={() => setMoreOpen(false)}
                      className={({ isActive }) =>
                        clsx(
                          'flex items-center gap-4 px-5 py-4 text-base font-medium transition-colors active:bg-ink/5',
                          isActive ? 'text-accent' : 'text-ink'
                        )
                      }
                    >
                      <item.icon size={21} className="shrink-0" strokeWidth={1.8} />
                      {item.label}
                    </NavLink>
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mx-auto flex max-w-md items-stretch">
          {primary.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'relative flex flex-1 flex-col items-center gap-1 px-1 pb-1 pt-3 text-[11px] font-semibold tracking-tight transition-colors duration-200',
                  isActive ? 'text-ink' : 'text-ink-faint active:text-ink'
                )
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && !moreOpen && (
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
            onClick={() => setMoreOpen((open) => !open)}
            aria-expanded={moreOpen}
            aria-controls="more-bar"
            aria-label="More"
            className={clsx(
              'relative flex flex-1 flex-col items-center gap-1 px-1 pb-1 pt-3 text-[11px] font-semibold tracking-tight transition-colors duration-200',
              moreOpen ? 'text-ink' : 'text-ink-faint active:text-ink'
            )}
          >
            {moreOpen && <span className="absolute inset-x-3 -top-px h-0.5 bg-accent" />}
            <MoreHorizontal size={21} strokeWidth={moreOpen ? 2.2 : 1.7} className={moreOpen ? 'text-accent' : ''} />
            More
          </button>
        </div>
      </nav>
    </>
  );
}
