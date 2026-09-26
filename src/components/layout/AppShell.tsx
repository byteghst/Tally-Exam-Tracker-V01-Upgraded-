import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';
import { ToastStack } from './ToastStack';
import { TopBar } from './TopBar';
import { CommandPalette } from './CommandPalette';
import { PageTransition } from './PageTransition';
import { OnboardingOverlay } from '@/components/features/onboarding/OnboardingOverlay';
import { ConfettiBurst } from '@/components/features/celebration/ConfettiBurst';
import { useAuthStore } from '@/store/authStore';
import { useExamStore } from '@/store/examStore';
import { useTaskStore } from '@/store/taskStore';
import { useExamConfigStore } from '@/store/examConfigStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useMilestoneCelebration } from '@/hooks/useMilestoneCelebration';
import { useNotificationSync } from '@/hooks/useNotificationSync';

export function AppShell() {
  const { session, initializing, user } = useAuthStore();

  const examStore = useExamStore();
  const taskStore = useTaskStore();
  const configStore = useExamConfigStore();
  const settingsStore = useSettingsStore();

  const { celebrating, finishCelebrating } = useMilestoneCelebration();
  useNotificationSync();

  // Hydrate everything once signed in, and subscribe to realtime so any
  // change made on another device (or the web app, if this is the
  // Capacitor build, or vice versa) shows up here immediately. Tear the
  // subscriptions down on sign-out so a later sign-in starts clean.
  useEffect(() => {
    if (!user) return;
    examStore.hydrate();
    taskStore.hydrate();
    configStore.hydrate();
    settingsStore.hydrate();
    examStore.subscribe();
    taskStore.subscribe();
    configStore.subscribe();
    settingsStore.subscribe();

    return () => {
      examStore.unsubscribe();
      taskStore.unsubscribe();
      configStore.unsubscribe();
      settingsStore.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  if (initializing) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <p className="text-sm text-ink-muted">Loading…</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex min-h-screen bg-surface text-ink">
      <div className="app-backdrop" aria-hidden />
      <Sidebar />
      <div className="flex-1 min-w-0">
        <main className="mx-auto max-w-6xl px-4 pb-24 pt-safe-top md:px-8 md:pb-8">
          <TopBar />
          <PageTransition>
            <Outlet />
          </PageTransition>
        </main>
      </div>
      <BottomNav />
      <ToastStack />
      <CommandPalette />
      <OnboardingOverlay />
      {celebrating && <ConfettiBurst onDone={finishCelebrating} />}
    </div>
  );
}
