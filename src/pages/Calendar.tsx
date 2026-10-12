import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Rise, Section, Stagger } from '@/components/motion/Reveal';
import { CalendarGrid, type DayMarkers } from '@/components/features/calendar/CalendarGrid';
import { DayAgenda } from '@/components/features/calendar/DayAgenda';
import { TaskForm } from '@/components/features/tasks/TaskForm';
import { useExamStore } from '@/store/examStore';
import { useTaskStore } from '@/store/taskStore';
import { useSettingsStore } from '@/store/settingsStore';
import { getMonthGrid, formatMonthYear, addMonths, todayISO, formatDate, parseISODate } from '@/lib/dates';
import { EASE_OUT } from '@/lib/motion';
import type { Task } from '@/types';

export function Calendar() {
  const { exams, hydrate: hydrateExams } = useExamStore();
  const { tasks, hydrate: hydrateTasks, toggleComplete } = useTaskStore();
  const { settings } = useSettingsStore();

  const today = parseISODate(todayISO());
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(todayISO());
  // -1 = went back, 1 = went forward: decides which way the month slides in
  const [direction, setDirection] = useState<1 | -1>(1);

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
    setDirection(delta > 0 ? 1 : -1);
    const next = addMonths(year, month, delta);
    setYear(next.year);
    setMonth(next.month);
  }

  function goToToday() {
    const target = today.getFullYear() * 12 + today.getMonth();
    setDirection(target >= year * 12 + month ? 1 : -1);
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setSelectedDate(todayISO());
  }

  const dayExams = exams.filter((e) => e.date === selectedDate);
  const dayTasks = tasks.filter((t) => t.date === selectedDate);

  return (
    <Stagger className="space-y-10 py-8">
      <Rise as="header" className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Schedule</p>
          <h1 className="mt-3 font-serif text-6xl leading-[0.9] tracking-tight text-ink">Calendar</h1>
        </div>
        <Button size="sm" variant="secondary" onClick={goToToday}>
          Today
        </Button>
      </Rise>

      <Rise>
        <div className="mb-3 flex items-center justify-between">
          <button
            onClick={() => goToMonth(-1)}
            aria-label="Previous month"
            className="rounded-control p-2 text-ink-muted hover:bg-ink/5 hover:text-ink"
          >
            <ChevronLeft size={22} />
          </button>
          <p className="font-serif text-3xl italic leading-none text-ink">{formatMonthYear(year, month)}</p>
          <button
            onClick={() => goToMonth(1)}
            aria-label="Next month"
            className="rounded-control p-2 text-ink-muted hover:bg-ink/5 hover:text-ink"
          >
            <ChevronRight size={22} />
          </button>
        </div>
        <motion.div
          key={`${year}-${month}`}
          initial={{ opacity: 0, x: direction * 28 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
        >
          <CalendarGrid
            days={days}
            currentMonth={month}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            markersByDate={markersByDate}
            firstDayOfWeek={settings.firstDayOfWeek}
          />
        </motion.div>
      </Rise>

      <Section label={selectedDate === todayISO() ? 'Today' : formatDate(selectedDate)}>
        <DayAgenda
          exams={dayExams}
          tasks={dayTasks}
          onToggleTask={toggleComplete}
          onEditTask={setEditingTask}
        />
      </Section>

      <TaskForm open={!!editingTask} onClose={() => setEditingTask(undefined)} task={editingTask} />
    </Stagger>
  );
}
