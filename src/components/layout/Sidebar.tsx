import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { clsx } from 'clsx';
import { TallyMark } from '@/components/ui/TallyMark';
import { NAV_ITEMS } from './navConfig';

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={clsx(
        'hidden md:flex flex-col shrink-0 border-r border-border bg-surface/60 backdrop-blur-glass transition-all duration-300',
        collapsed ? 'w-[76px]' : 'w-[240px]'
      )}
    >
      <div className="flex items-center gap-2 px-4 py-5">
        <TallyMark size={28} className="shrink-0 text-ink" />
        {!collapsed && (
          <span className="font-display text-lg font-semibold text-ink">
            Tally<span className="text-accent">.</span>
          </span>
        )}
      </div>

      <nav className="flex-1 space-y-1 px-2">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            title={item.label}
            className={({ isActive }) =>
              clsx(
                'group relative flex items-center gap-3 rounded-control px-3 py-2.5 text-sm font-medium transition-all duration-200',
                isActive ? 'bg-accent/15 text-accent' : 'text-ink-muted hover:bg-white/5 hover:text-ink active:scale-[0.98]'
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={clsx(
                    'absolute left-0 h-5 w-1 rounded-r-full bg-accent transition-transform duration-200',
                    isActive ? 'scale-y-100' : 'scale-y-0'
                  )}
                />
                <item.icon size={20} className="shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <button
        onClick={() => setCollapsed((c) => !c)}
        className="m-2 flex items-center justify-center gap-2 rounded-control py-2 text-ink-muted transition-all hover:bg-white/5 hover:text-ink active:scale-95"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
      </button>
    </aside>
  );
}
