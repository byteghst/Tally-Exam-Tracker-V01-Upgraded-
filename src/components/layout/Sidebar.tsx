import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { clsx } from 'clsx';
import { TallyMark } from '@/components/ui/TallyMark';
import { NAV_ITEMS } from './navConfig';
import { spring } from '@/lib/motion';

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={clsx(
        'hidden shrink-0 flex-col bg-surface-raised transition-[width] duration-300 md:flex',
        collapsed ? 'w-[76px]' : 'w-[240px]'
      )}
    >
      <div className="flex items-center gap-3 px-5 py-6">
        <TallyMark size={28} className="shrink-0" />
        {!collapsed && <span className="font-serif text-3xl leading-none tracking-tight text-ink">Tally</span>}
      </div>

      <nav className="flex-1 space-y-0.5 px-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={item.label}
            className={({ isActive }) =>
              clsx(
                'relative flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-colors duration-200',
                isActive ? 'text-ink' : 'text-ink-faint hover:text-ink'
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <motion.span
                    layoutId="sidebar-indicator"
                    transition={spring}
                    className="absolute inset-0 rounded-control bg-accent-soft"
                  />
                )}
                <item.icon size={20} className={clsx('relative shrink-0', isActive && 'text-accent')} />
                {!collapsed && <span className="relative">{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={() => setCollapsed((c) => !c)}
        className="m-2 flex items-center justify-center gap-2 rounded-control py-2 text-ink-faint transition-colors hover:bg-ink/5 hover:text-ink"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
      </button>
    </aside>
  );
}
