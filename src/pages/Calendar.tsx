import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { CalendarGrid, type DayMarkers } from '@/components/features/calendar/CalendarGrid';
import { DayAgenda } from '@/components/features/calendar/DayAgenda';
import { TaskForm } from '@/components/features/tasks/TaskForm';
import { useExamStore } from '@/store/examStore';
import { useTaskStore } from '@/store/taskStore';
import { useSettingsStore } from '@/store/settingsStore';
import { getMonthGrid, formatMonthYear, addMonths, todayISO, formatDate, parseISODate } from '@/lib/dates';
import type { Task } from '@/types';

export function Calendar() {
  const { exams, hydrate: hydrateExams } = useExamStore();
  const { tasks, hydrate: hydrateTasks, toggleComplete } = useTaskStore();
  const { settings } = useSettingsStore();

  const today = parseISODate(todayISO());
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayISO());

  const [editingTask, setEditingTask] = useState<Task | undefined>(undefined);

  useEffect(() => {
    hydrateExams();
    hydrateTasks();
  }, [hydrateExams, hydrateTasks]);

  const days = useMemo(
    () => getMonthGrid(year, month, settings.firstDayOfWeek),
    [year, month, settings.firstDayOfWeek]
  );

  const markersByDate = useMemo(() => {
    const map: Record<string, DayMarkers> = {};
    function bump(date: string, key: keyof DayMarkers) {
      if (!map[date]) map[date] = { examCount: 0, taskCount: 0 };
      map[date][key]++;
    }
    for (const e of exams) bump(e.date, 'examCount');
    for (const t of tasks) {
      if (t.date) bump(t.date, 'taskCount');
    }
    return map;
  }, [exams, tasks]);

  function goToMonth(delta: number) {
    const next = addMonths(year, month, delta);
    setYear(next.year);
    setMonth(next.month);
  }

  function goToToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDate(todayISO());
  }

  const dayExams = exams.filter((e) => e.date === selectedDate);
  const dayTasks = tasks.filter((t) => t.date === selectedDate);

  return (
    <div className="space-y-5 py-6">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Calendar</h1>
        <Button size="sm" variant="secondary" onClick={goToToday}>
          Today
        </Button>
      </header>

      <GlassCard className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => goToMonth(-1)}
            aria-label="Previous month"
            className="rounded-control p-1.5 text-ink-muted hover:bg-white/5 hover:text-ink"
          >
            <ChevronLeft size={20} />
          </button>
          <p className="font-display text-base font-semibold text-ink">{formatMonthYear(year, month)}</p>
          <button
            onClick={() => goToMonth(1)}
            aria-label="Next month"
            className="rounded-control p-1.5 text-ink-muted hover:bg-white/5 hover:text-ink"
          >
            <ChevronRight size={20} />
          </button>
        </div>
        <CalendarGrid
          days={days}
          currentMonth={month}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          markersByDate={markersByDate}
          firstDayOfWeek={settings.firstDayOfWeek}
        />
      </GlassCard>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-muted">
          {selectedDate === todayISO() ? 'Today' : formatDate(selectedDate)}
        </h2>
        <DayAgenda
          exams={dayExams}
          tasks={dayTasks}
          onToggleTask={toggleComplete}
          onEditTask={setEditingTask}
        />
      </section>

      <TaskForm open={!!editingTask} onClose={() => setEditingTask(undefined)} task={editingTask} />
    </div>
  );
}
