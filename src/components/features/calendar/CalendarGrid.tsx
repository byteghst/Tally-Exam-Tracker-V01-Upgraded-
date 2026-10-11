import { clsx } from 'clsx';
import { parseISODate, todayISO, formatDate } from '@/lib/dates';

export interface DayMarkers {
  examCount: number;
  taskCount: number;
}

interface CalendarGridProps {
  days: string[];
  currentMonth: number;
  selectedDate: string;
  onSelectDate: (date: string) => void;
  markersByDate: Record<string, DayMarkers>;
  firstDayOfWeek: 0 | 1;
}

const WEEKDAY_LABELS_SUN_FIRST = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function CalendarGrid({
  days,
  currentMonth,
  selectedDate,
  onSelectDate,
  markersByDate,
  firstDayOfWeek
}: CalendarGridProps) {
  const labels =
    firstDayOfWeek === 1
      ? [...WEEKDAY_LABELS_SUN_FIRST.slice(1), WEEKDAY_LABELS_SUN_FIRST[0]]
      : WEEKDAY_LABELS_SUN_FIRST;

  const today = todayISO();

  return (
    <div>
      <div className="grid grid-cols-7 border-b border-border pb-2">
        {labels.map((label, i) => (
          <div key={`${label}-${i}`} className="eyebrow text-center">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((date) => {
          const inMonth = parseISODate(date).getMonth() === currentMonth;
          const isToday = date === today;
          const isSelected = date === selectedDate;
          const markers = markersByDate[date];
          const dayNum = parseISODate(date).getDate();

          return (
            <button
              key={date}
              onClick={() => onSelectDate(date)}
              className={clsx(
                'relative flex aspect-square flex-col items-center justify-center gap-1 text-base transition-colors duration-200',
                !inMonth && 'text-ink-faint/40',
                inMonth && !isSelected && 'text-ink hover:bg-ink/5',
                isSelected && 'bg-ink text-surface',
                isToday && !isSelected && 'font-bold text-accent'
              )}
              aria-current={isToday ? 'date' : undefined}
              aria-label={formatDate(date)}
            >
              <span className="font-numeric tabular-nums">{dayNum}</span>
              {/* dot colours: exam = persimmon, task = forest */}
              <span className="flex h-1.5 gap-1">
                {markers && markers.examCount > 0 && <Dot color="bg-accent" />}
                {markers && markers.taskCount > 0 && <Dot color="bg-forest" />}
              </span>
              {isToday && <span className="absolute inset-x-3 bottom-1 h-0.5 bg-accent" aria-hidden />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className={clsx('h-1.5 w-1.5 rounded-full', color)} />;
}
