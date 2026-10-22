import { useEffect, useState } from 'react';
import { TallyLoader } from '@/components/ui/TallyLoader';
import { useExamStore } from '@/store/examStore';
import { useTaskStore } from '@/store/taskStore';
import { useExamConfigStore } from '@/store/examConfigStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useStudyStore } from '@/store/studyStore';
import { useDeadlineStore } from '@/store/deadlineStore';

const isLoading = (state: unknown) => Boolean((state as { loading?: boolean }).loading);

/**
 * A small Tally loader that appears whenever any list is being read from the
 * account (opening a screen, reconnecting, signing in). It waits a moment before
 * showing, so quick reads never flash it, and it never blocks the screen.
 */
export function SyncIndicator() {
  const busy = [
    useExamStore(isLoading),
    useTaskStore(isLoading),
    useExamConfigStore(isLoading),
    useSettingsStore(isLoading),
    useStudyStore(isLoading),
    useDeadlineStore(isLoading)
  ].some(Boolean);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!busy) {
      setShow(false);
      return;
    }
    const t = setTimeout(() => setShow(true), 450);
    return () => clearTimeout(t);
  }, [busy]);

  if (!show) return null;
  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full bg-surface-raised px-4 py-2.5 shadow-raise md:bottom-6">
      <TallyLoader size={40} label="Syncing" />
    </div>
  );
}
