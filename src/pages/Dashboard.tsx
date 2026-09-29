import { useEffect, useState } from 'react';
import { ExamForm } from '@/components/features/exams/ExamForm';
import { TaskForm } from '@/components/features/tasks/TaskForm';
import { DashboardGreeting } from '@/components/features/dashboard/DashboardGreeting';
import { MomentumCard } from '@/components/features/dashboard/MomentumCard';
import { DailyMission } from '@/components/features/dashboard/DailyMission';
import { TodaysTasksWidget } from '@/components/widgets/TodaysTasksWidget';
import { ExamCountdownHero } from '@/components/widgets/ExamCountdownHero';
import { StudyTimeWidget } from '@/components/widgets/StudyTimeWidget';
import { useExamStore } from '@/store/examStore';
import { useTaskStore } from '@/store/taskStore';
import { useSettingsStore } from '@/store/settingsStore';
import { isFuture, todayISO } from '@/lib/dates';
import { getVisibleOrderedIds } from '@/lib/dashboardWidgets';
import { sortExamsByDateTime } from '@/lib/examSort';
import { computeDailyMission } from '@/lib/dailyMission';

export function Dashboard() {
  const { exams, hydrate: hydrateExams } = useExamStore();
  const { tasks, hydrate: hydrateTasks, toggleComplete } = useTaskStore();
  const { settings, updateSettings } = useSettingsStore();

  const [examFormOpen, setExamFormOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);

  useEffect(() => {
    hydrateExams();
    hydrateTasks();
  }, [hydrateExams, hydrateTasks]);

  const todaysTasks = tasks.filter((t) => t.date === todayISO());
  const nextExam = sortExamsByDateTime(exams.filter((e) => e.status === 'upcoming' && isFuture(e.date)))[0];

  const visibleIds = getVisibleOrderedIds(settings.dashboardLayout);

  const missionItems = computeDailyMission({ tasks, exams });
  const missionDismissedToday = settings.dailyMissionDismissedDate === todayISO();
  const showMission = settings.showDailyMission && !missionDismissedToday && missionItems.length > 0;

  const compact = settings.density === 'compact';

  return (
    <div className={compact ? 'space-y-3 py-4' : 'space-y-5 py-6'}>
      <DashboardGreeting userName={settings.userName} exams={exams} tasks={tasks} />

      {settings.streaksEnabled && <MomentumCard exams={exams} tasks={tasks} />}

      {showMission && (
        <DailyMission
          items={missionItems}
          onDismiss={() => updateSettings({ dailyMissionDismissedDate: todayISO() })}
        />
      )}

      {/* Always shown, above the customizable widgets below — no longer part
          of the show/hide/reorder list, so it can't be hidden or moved. */}
      <ExamCountdownHero exam={nextExam} onAddExam={() => setExamFormOpen(true)} />

      {visibleIds.length === 0 ? (
        <p className="text-sm text-ink-muted">
          All dashboard widgets are hidden. Turn some back on from Settings → Dashboard.
        </p>
      ) : (
        <div className={`grid grid-cols-1 md:grid-cols-2 ${compact ? 'gap-3' : 'gap-4'}`}>
          {visibleIds.map((id) => {
            switch (id) {
              case 'todays-tasks':
                return (
                  <TodaysTasksWidget
                    key={id}
                    tasks={todaysTasks}
                    onToggle={toggleComplete}
                    onAddTask={() => setTaskFormOpen(true)}
                  />
                );
              case 'study-time':
                return <StudyTimeWidget key={id} />;
              default:
                return null;
            }
          })}
        </div>
      )}

      <ExamForm open={examFormOpen} onClose={() => setExamFormOpen(false)} />
      <TaskForm open={taskFormOpen} onClose={() => setTaskFormOpen(false)} />
    </div>
  );
}
