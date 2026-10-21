import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { ToastStack } from './ToastStack';
import { PageTransition } from './PageTransition';
import { OfflineBanner } from './OfflineBanner';
import { OnboardingOverlay } from '@/components/features/onboarding/OnboardingOverlay';
import { ConfettiBurst } from '@/components/features/celebration/ConfettiBurst';
import { UpdatePrompt } from '@/components/features/update/UpdatePrompt';
import { useAuthStore } from '@/store/authStore';
import { useExamStore } from '@/store/examStore';
import { useTaskStore } from '@/store/taskStore';
import { useExamConfigStore } from '@/store/examConfigStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useStudyStore } from '@/store/studyStore';
import { useDeadlineStore } from '@/store/deadlineStore';
import { useMilestoneCelebration } from '@/hooks/useMilestoneCelebration';
import { useNotificationSync } from '@/hooks/useNotificationSync';
import { useReconnectSync } from '@/hooks/useReconnectSync';
import { loadOutboxCount } from '@/lib/outbox';

export function AppShell() {
  const { session, initializing, user } = useAuthStore();

  const examStore = useExamStore();
  const taskStore = useTaskStore();
  const configStore = useExamConfigStore();
  const settingsStore = useSettingsStore();
  const studyStore = useStudyStore();
  const deadlineStore = useDeadlineStore();

  const { celebrating, finishCelebrating } = useMilestoneCelebration();
  useNotificationSync();
  // Send offline changes and re-read everything from the account when the connection comes back.
  useReconnectSync(Boolean(user));

  // Hydrate everything once signed in, and subscribe to realtime so any
  // change made on another device (or the web app, if this is the
  // Capacitor build, or vice versa) shows up here immediately. Tear the
  // subscriptions down on sign-out so a later sign-in starts clean.
  useEffect(() => {
    if (!user) return;
    // Changes made offline in an earlier session are sent by the hydrate calls below.
    loadOutboxCount(user.id);
    examStore.hydrate();
    taskStore.hydrate();
    configStore.hydrate();
    settingsStore.hydrate();
    deadlineStore.hydrate();
    studyStore.hydrate(user.id);
    examStore.subscribe();
    taskStore.subscribe();
    configStore.subscribe();
    settingsStore.subscribe();
    deadlineStore.subscribe();
    studyStore.subscribe();

    return () => {
      examStore.unsubscribe();
      taskStore.unsubscribe();
      configStore.unsubscribe();
      settingsStore.unsubscribe();
      deadlineStore.unsubscribe();
      studyStore.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (initializing) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <p className="eyebrow">Loading</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    // reducedMotion="user": if the phone's "remove animations" setting is on,
    // movement-based animation is skipped everywhere.
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen bg-surface text-ink">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <main className="mx-auto max-w-6xl px-5 pb-28 pt-safe-top md:px-10 md:pb-10">
            <OfflineBanner />
            <PageTransition>
              <Outlet />
            </PageTransition>
          </main>
        </div>
        <BottomNav />
        <ToastStack />
        <OnboardingOverlay />
        <UpdatePrompt />
        {celebrating && <ConfettiBurst onDone={finishCelebrating} />}
      </div>
    </MotionConfig>
  );
}
