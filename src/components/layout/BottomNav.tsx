import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { AnimatePresence, motion, useIsPresent } from 'framer-motion';
import { MoreHorizontal } from 'lucide-react';
import { clsx } from 'clsx';
import { NAV_ITEMS } from './navConfig';
import { EASE_OUT, spring } from '@/lib/motion';

/** Dims the page behind the open More bar. Ignores touches the moment it starts fading out. */
function Scrim({ onClick }: { onClick: () => void }) {
  const isPresent = useIsPresent();
  return (
    <motion.div
      className="fixed inset-0 z-30 bg-ink/25 md:hidden"
      style={{ pointerEvents: isPresent ? 'auto' : 'none' }}
      onClick={onClick}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    />
  );
}

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
      <AnimatePresence>{moreOpen && <Scrim key="more-scrim" onClick={() => setMoreOpen(false)} />}</AnimatePresence>

      <nav
        className={clsx(
          'fixed inset-x-0 bottom-0 z-40 w-full max-w-full overflow-visible bg-surface-raised pb-safe-bottom shadow-sheet md:hidden',
          !moreOpen && 'rounded-t-[24px]'
        )}
        aria-label="Primary"
      >
        <AnimatePresence initial={false}>
          {moreOpen && (
            <motion.div
              key="more-bar"
              id="more-bar"
              initial={{ height: 0 }}
              animate={{ height: 'auto' }}
              exit={{ height: 0 }}
              transition={{ duration: 0.45, ease: EASE_OUT }}
              className="absolute inset-x-0 bottom-full overflow-hidden rounded-t-[24px] bg-surface-raised"
            >
              <ul className="space-y-0.5 px-2 pb-1 pt-3">
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
                          'flex items-center gap-4 rounded-control px-4 py-3.5 text-base font-medium transition-colors active:bg-ink/5',
                          isActive ? 'bg-accent-soft text-accent' : 'text-ink'
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

        <div className="mx-auto flex w-full max-w-md items-stretch">
          {primary.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setMoreOpen(false)}
              className={({ isActive }) =>
                clsx(
                  'relative flex min-w-0 flex-1 flex-col items-center gap-1 px-0.5 pb-1 pt-3 text-[10px] font-semibold leading-tight tracking-tight transition-colors duration-200 sm:px-1 sm:text-[11px]',
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
                      className="absolute inset-x-0 top-1.5 mx-auto h-8 w-12 max-w-full rounded-full bg-accent-soft"
                    />
                  )}
                  <item.icon
                    size={21}
                    strokeWidth={isActive ? 2.2 : 1.7}
                    className={clsx('relative shrink-0', isActive && 'text-accent')}
                  />
                  <span className="relative block max-w-full whitespace-nowrap">{item.label}</span>
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
              'relative flex min-w-0 flex-1 flex-col items-center gap-1 px-0.5 pb-1 pt-3 text-[10px] font-semibold leading-tight tracking-tight transition-colors duration-200 sm:px-1 sm:text-[11px]',
              moreOpen ? 'text-ink' : 'text-ink-faint active:text-ink'
            )}
          >
            {moreOpen && <span className="absolute inset-x-0 top-1.5 mx-auto h-8 w-12 max-w-full rounded-full bg-accent-soft" />}
            <MoreHorizontal
              size={21}
              strokeWidth={moreOpen ? 2.2 : 1.7}
              className={clsx('relative shrink-0', moreOpen && 'text-accent')}
            />
            <span className="relative block max-w-full whitespace-nowrap">More</span>
          </button>
        </div>
      </nav>
    </>
  );
}
