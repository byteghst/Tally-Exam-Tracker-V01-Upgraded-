import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, FileSpreadsheet, ListChecks, SlidersHorizontal, Plus, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useUIStore } from '@/store/uiStore';
import { useExamStore } from '@/store/examStore';
import { useTaskStore } from '@/store/taskStore';
import { useExamConfigStore } from '@/store/examConfigStore';
import { formatDate } from '@/lib/dates';

interface ResultItem {
  id: string;
  label: string;
  sublabel: string;
  icon: typeof FileSpreadsheet;
  onSelect: () => void;
}

export function CommandPalette() {
  const { commandPaletteOpen, setCommandPaletteOpen } = useUIStore();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');

  const { exams } = useExamStore();
  const { tasks } = useTaskStore();
  const { configs } = useExamConfigStore();

  // global Ctrl/Cmd+K shortcut, from anywhere in the app
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [setCommandPaletteOpen]);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      document.body.style.overflow = 'hidden';
      const timer = setTimeout(() => inputRef.current?.focus(), 0);
      return () => {
        document.body.style.overflow = '';
        clearTimeout(timer);
      };
    }
  }, [commandPaletteOpen]);

  useEffect(() => {
    if (!commandPaletteOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setCommandPaletteOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  function close() {
    setCommandPaletteOpen(false);
  }

  function goToWithAdd(path: string) {
    navigate(path, { state: { openAdd: true } });
    close();
  }

  const quickActions: ResultItem[] = [
    {
      id: 'add-exam',
      label: 'Add exam',
      sublabel: 'Quick action',
      icon: Plus,
      onSelect: () => goToWithAdd('/exams')
    },
    {
      id: 'add-task',
      label: 'Add task',
      sublabel: 'Quick action',
      icon: Plus,
      onSelect: () => goToWithAdd('/tasks')
    },
    {
      id: 'add-config',
      label: 'New exam config',
      sublabel: 'Quick action',
      icon: Plus,
      onSelect: () => goToWithAdd('/configs')
    }
  ];

  const searchResults: ResultItem[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const examResults: ResultItem[] = exams
      .filter((e) => e.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((e) => ({
        id: `exam-${e.id}`,
        label: e.name,
        sublabel: `Exam · ${formatDate(e.date)}`,
        icon: FileSpreadsheet,
        onSelect: () => {
          navigate(`/exams/${e.id}`);
          close();
        }
      }));

    const taskResults: ResultItem[] = tasks
      .filter((t) => t.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((t) => ({
        id: `task-${t.id}`,
        label: t.name,
        sublabel: t.date ? `Task · ${formatDate(t.date)}` : 'Task',
        icon: ListChecks,
        onSelect: () => {
          navigate('/tasks');
          close();
        }
      }));

    const configResults: ResultItem[] = configs
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 5)
      .map((c) => ({
        id: `config-${c.id}`,
        label: c.name,
        sublabel: 'Exam config',
        icon: SlidersHorizontal,
        onSelect: () => {
          navigate('/configs');
          close();
        }
      }));

    return [...examResults, ...taskResults, ...configResults];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, exams, tasks, configs]);

  if (!commandPaletteOpen) return null;

  const showingSearch = query.trim().length > 0;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-16 md:pt-24" role="presentation">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={close} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search and quick actions"
        className="relative flex max-h-[70vh] w-[92vw] max-w-lg flex-col rounded-card border border-border bg-surface-raised shadow-glass"
      >
        <div className="flex shrink-0 items-center gap-2 border-b border-border px-4 py-3">
          <Search size={18} className="text-ink-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search exams, tasks, configs..."
            className="flex-1 bg-transparent text-ink placeholder:text-ink-faint focus-visible:outline-none"
          />
          <button onClick={close} aria-label="Close" className="text-ink-muted hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {!showingSearch && (
            <>
              <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-faint">
                Quick actions
              </p>
              {quickActions.map((item) => (
                <ResultRow key={item.id} item={item} />
              ))}
            </>
          )}

          {showingSearch && searchResults.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-ink-muted">No matches for "{query}"</p>
          )}

          {showingSearch &&
            searchResults.map((item) => <ResultRow key={item.id} item={item} />)}
        </div>
      </div>
    </div>,
    document.body
  );
}

function ResultRow({ item }: { item: ResultItem }) {
  const Icon = item.icon;
  return (
    <button
      onClick={item.onSelect}
      className="flex w-full items-center gap-3 rounded-control px-3 py-2.5 text-left hover:bg-white/5"
    >
      <Icon size={18} className="shrink-0 text-ink-muted" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-ink">{item.label}</span>
        <span className="block text-xs text-ink-faint">{item.sublabel}</span>
      </span>
    </button>
  );
}
