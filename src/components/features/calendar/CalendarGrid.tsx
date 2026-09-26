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

const WEEKDAY_LABELS_SUN_FIRST = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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
      <div className="grid grid-cols-7 gap-1 pb-1">
        {labels.map((label) => (
          <div key={label} className="text-center text-xs font-medium text-ink-faint">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
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
                'flex aspect-square flex-col items-center justify-center gap-0.5 rounded-control text-sm transition-colors',
                !inMonth && 'text-ink-faint/50',
                inMonth && !isSelected && 'text-ink hover:bg-white/5',
                isSelected && 'bg-accent text-white',
                isToday && !isSelected && 'font-semibold text-accent'
              )}
              aria-current={isToday ? 'date' : undefined}
              aria-label={formatDate(date)}
            >
              <span>{dayNum}</span>
              {markers && (
                <span className="flex gap-0.5">
                  {markers.examCount > 0 && <Dot color={isSelected ? 'bg-white' : 'bg-accent'} />}
                  {markers.taskCount > 0 && <Dot color={isSelected ? 'bg-white' : 'bg-success'} />}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Dot({ color }: { color: string }) {
  return <span className={clsx('h-1 w-1 rounded-full', color)} />;
}
