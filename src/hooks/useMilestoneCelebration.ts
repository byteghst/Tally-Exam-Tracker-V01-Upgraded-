import { useEffect, useRef, useState } from 'react';
import { useExamStore } from '@/store/examStore';
import { useTaskStore } from '@/store/taskStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUIStore } from '@/store/uiStore';
import { computeMilestones, type Milestone } from '@/lib/milestones';

export function useMilestoneCelebration() {
  const exams = useExamStore((s) => s.exams);
  const tasks = useTaskStore((s) => s.tasks);
  const { settings, updateSettings, loaded } = useSettingsStore();
  const pushToast = useUIStore((s) => s.pushToast);

  const [celebrating, setCelebrating] = useState<Milestone | null>(null);
  const queueRef = useRef<Milestone[]>([]);
  const checkedRef = useRef(false);
  const hasAnyData = exams.length > 0 || tasks.length > 0;

  useEffect(() => {
    if (checkedRef.current) return;
    // Wait for the saved settings to load first. This check reads
    // `celebrationBaselineDone` and writes back to settings; if it ran while
    // `settings` was still the placeholder defaults, it would save those
    // defaults over the real ones (wiping the saved name and the intro flag).
    if (!loaded) return;
    // Wait for stores to actually be hydrated (or genuinely confirmed
    // empty) before computing — an app with real history that just hasn't
    // finished its first read yet would otherwise look "empty" for a tick.
    if (!hasAnyData) return;
    checkedRef.current = true;

    const milestones = computeMilestones({ exams, tasks });

    if (!settings.celebrationBaselineDone) {
      // First time this feature has ever run for this install — treat
      // everything already true as already-seen, silently, rather than
      // celebrating months of history all at once.
      updateSettings({
        celebratedMilestoneIds: milestones.map((m) => m.id),
        celebrationBaselineDone: true
      });
      return;
    }

    const celebratedSet = new Set(settings.celebratedMilestoneIds);
    const newOnes = milestones.filter((m) => !celebratedSet.has(m.id));
    if (newOnes.length === 0) return;

    queueRef.current = newOnes.slice(1);
    setCelebrating(newOnes[0]);
    updateSettings({ celebratedMilestoneIds: [...settings.celebratedMilestoneIds, ...newOnes.map((m) => m.id)] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAnyData, loaded]);

  function finishCelebrating() {
    if (celebrating) pushToast(`🎉 ${celebrating.label}`);
    setCelebrating(null);
    const next = queueRef.current.shift();
    if (next) {
      setTimeout(() => setCelebrating(next), 500);
    }
  }

  return { celebrating, finishCelebrating };
}
