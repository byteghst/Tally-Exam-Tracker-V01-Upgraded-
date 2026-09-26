import { Search } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';

export function TopBar() {
  const { setCommandPaletteOpen } = useUIStore();

  return (
    <div className="sticky top-0 z-30 -mx-4 mb-2 bg-surface/80 px-4 pt-safe-top backdrop-blur-glass md:-mx-8 md:px-8">
      <button
        onClick={() => setCommandPaletteOpen(true)}
        className="flex w-full items-center gap-2 rounded-control border border-border bg-surface-raised px-3.5 py-2.5 text-left text-sm text-ink-faint hover:bg-white/5"
      >
        <Search size={16} />
        <span className="flex-1">Search or jump to...</span>
        <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-xs text-ink-faint md:inline">
          Ctrl K
        </kbd>
      </button>
    </div>
  );
}
