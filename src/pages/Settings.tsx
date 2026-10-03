import { useCallback, useEffect, useState } from 'react';
import { ChevronUp, ChevronDown, Bell, BellOff, LogOut, AlertTriangle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { normalizeLayout, WIDGET_LABELS } from '@/lib/dashboardWidgets';
import {
  RESYNC_EVENT,
  requestNativeNotificationPermission,
  getNativeNotificationPermission,
  getNativeReminderStatus,
  openExactAlarmSettings,
  sendTestNativeNotification,
  type NativeReminderStatus
} from '@/lib/notifications/nativeScheduler';
import {
  requestWebNotificationPermission,
  getWebNotificationPermission,
  sendTestWebNotification,
  isWebNotificationSupported
} from '@/lib/notifications/webChecker';
import type { ThemeMode, DensityLevel, ExamType } from '@/types';

const THEME_OPTIONS: ThemeMode[] = ['light', 'dark', 'system'];
const DENSITY_OPTIONS: DensityLevel[] = ['comfortable', 'compact'];

type PermissionState = 'unknown' | 'granted' | 'denied' | 'unsupported';

// Which build is installed: the short commit id (compare with the latest
// commit on GitHub) and when it was built. Injected by vite.config.ts.
const BUILD_LABEL = `Build ${__APP_COMMIT__} · ${new Date(__APP_BUILT__).toLocaleString(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit'
})}`;

function formatWhen(d: Date): string {
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function Settings() {
  const { settings, updateSettings, resetSettings } = useSettingsStore();
  const { user, signOut } = useAuthStore();
  const pushToast = useUIStore((s) => s.pushToast);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [permission, setPermission] = useState<PermissionState>('unknown');
  const [native, setNative] = useState<NativeReminderStatus | null>(null);
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (isNative) {
      getNativeNotificationPermission()
        .then((granted) => setPermission(granted ? 'granted' : 'denied'))
        .catch(() => setPermission('denied'));
    } else if (isWebNotificationSupported()) {
      const p = getWebNotificationPermission();
      setPermission(p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'unknown');
    } else {
      setPermission('unsupported');
    }
  }, [isNative]);

  // Live reminder status (permission, exact timing, how many are scheduled).
  const refreshNative = useCallback(async () => {
    if (!isNative) return;
    try {
      const status = await getNativeReminderStatus();
      setNative(status);
      setPermission(status.permission ? 'granted' : 'denied');
    } catch {
      // purely informational
    }
  }, [isNative]);

  useEffect(() => {
    if (!isNative) return;
    void refreshNative();
    const id = setInterval(() => void refreshNative(), 3000);
    return () => clearInterval(id);
  }, [isNative, refreshNative]);

  async function handleEnableNotifications() {
    try {
      const granted = isNative ? await requestNativeNotificationPermission() : await requestWebNotificationPermission();
      setPermission(granted ? 'granted' : 'denied');
    } catch {
      setPermission('denied');
    }
    if (isNative) {
      // schedule right away instead of waiting for the next data change
      window.dispatchEvent(new Event(RESYNC_EVENT));
      setTimeout(() => void refreshNative(), 1500);
    }
  }

  async function handleTestNotification() {
    try {
      if (isNative) {
        await sendTestNativeNotification();
        pushToast('Test sent — it should appear in a few seconds');
      } else {
        sendTestWebNotification();
      }
    } catch {
      pushToast(
        "Couldn't send the test. Make sure notifications are allowed for Tally in your phone's settings.",
        undefined,
        'error'
      );
    }
  }

  async function handleFixExactAlarms() {
    await openExactAlarmSettings();
    setTimeout(() => void refreshNative(), 1500);
  }

  const widgetItems = normalizeLayout(settings.dashboardLayout);

  function toggleWidget(id: string) {
    const next = widgetItems.map((w) => (w.id === id ? { ...w, visible: !w.visible } : w));
    updateSettings({ dashboardLayout: next });
  }

  function moveWidget(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= widgetItems.length) return;
    const reordered = [...widgetItems];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
    updateSettings({ dashboardLayout: reordered.map((w, i) => ({ ...w, order: i })) });
  }

  const prefs = settings.notificationPrefs;

  return (
    <div className="space-y-6 py-6">
      <h1 className="font-display text-2xl font-semibold text-ink">Settings</h1>

      <GlassCard className="space-y-3 p-5">
        <h2 className="font-medium text-ink">Account</h2>
        <p className="text-sm text-ink-muted">
          Signed in as <span className="text-ink">{user?.email}</span>. Your exams, tasks and configs sync to every
          device you sign in on.
        </p>
        <Button variant="secondary" size="sm" onClick={() => setSignOutConfirmOpen(true)}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </GlassCard>

      <GlassCard className="space-y-3 p-5">
        <h2 className="font-medium text-ink">Personal</h2>
        <Input
          label="Your name (optional)"
          value={settings.userName ?? ''}
          onChange={(e) => updateSettings({ userName: e.target.value || undefined })}
          placeholder="Used for the Dashboard greeting"
        />
        <p className="-mt-1 text-xs text-ink-faint">
          Saved to your account, so it stays the same after app updates and on all your devices. Change it here any
          time.
        </p>
        <Select
          label="Default exam type when adding"
          value={settings.defaultExamType}
          onChange={(e) => updateSettings({ defaultExamType: e.target.value as ExamType })}
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </Select>
      </GlassCard>

      <GlassCard className="space-y-4 p-5">
        <h2 className="font-medium text-ink">Appearance</h2>
        <div className="flex gap-2">
          {THEME_OPTIONS.map((mode) => (
            <button
              key={mode}
              onClick={() => updateSettings({ theme: mode })}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium capitalize ${
                settings.theme === mode ? 'bg-accent text-white' : 'bg-white/5 text-ink-muted'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-faint">
          Glass, blur and motion are tuned for a consistent look and are no longer adjustable here.
        </p>
      </GlassCard>

      <GlassCard className="space-y-3 p-5">
        <h2 className="font-medium text-ink">Dashboard</h2>

        <div className="space-y-2">
          <label className="flex items-center justify-between rounded-control border border-border p-3 text-sm text-ink">
            Momentum tracker
            <input
              type="checkbox"
              checked={settings.streaksEnabled}
              onChange={(e) => updateSettings({ streaksEnabled: e.target.checked })}
              className="h-4 w-4 rounded accent-accent"
            />
          </label>
          <label className="flex items-center justify-between rounded-control border border-border p-3 text-sm text-ink">
            Daily Mission
            <input
              type="checkbox"
              checked={settings.showDailyMission}
              onChange={(e) => updateSettings({ showDailyMission: e.target.checked })}
              className="h-4 w-4 rounded accent-accent"
            />
          </label>
        </div>

        <p className="text-xs text-ink-faint">
          The Next Exam card always shows above the widgets below and can't be hidden or reordered.
        </p>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-ink-muted">Density</span>
          <div className="flex gap-2">
            {DENSITY_OPTIONS.map((d) => (
              <button
                key={d}
                onClick={() => updateSettings({ density: d })}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium capitalize ${
                  settings.density === d ? 'bg-accent text-white' : 'bg-white/5 text-ink-muted'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <p className="text-sm text-ink-muted">Choose which widgets show below, and in what order.</p>
        <div className="space-y-2">
          {widgetItems.map((w, i) => (
            <div key={w.id} className="flex items-center justify-between rounded-control border border-border p-3">
              <label className="flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={w.visible}
                  onChange={() => toggleWidget(w.id)}
                  className="h-4 w-4 rounded accent-accent"
                />
                {WIDGET_LABELS[w.id]}
              </label>
              <div className="flex gap-1">
                <button
                  onClick={() => moveWidget(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${WIDGET_LABELS[w.id]} up`}
                  className="rounded-control p-1.5 text-ink-muted hover:bg-white/5 hover:text-ink disabled:opacity-30"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  onClick={() => moveWidget(i, 1)}
                  disabled={i === widgetItems.length - 1}
                  aria-label={`Move ${WIDGET_LABELS[w.id]} down`}
                  className="rounded-control p-1.5 text-ink-muted hover:bg-white/5 hover:text-ink disabled:opacity-30"
                >
                  <ChevronDown size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="space-y-3 p-5">
        <h2 className="font-medium text-ink">Notifications</h2>

        {permission === 'unsupported' ? (
          <p className="text-sm text-ink-muted">Notifications aren't supported in this browser.</p>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-control border border-border p-3">
              <div className="flex items-center gap-2 text-sm text-ink">
                {permission === 'granted' ? (
                  <Bell size={16} className="text-success" />
                ) : (
                  <BellOff size={16} className="text-ink-faint" />
                )}
                {permission === 'granted' ? 'Notifications enabled' : 'Notifications not enabled'}
              </div>
              {permission !== 'granted' && (
                <Button size="sm" onClick={handleEnableNotifications}>
                  Enable
                </Button>
              )}
            </div>

            {isNative && permission !== 'granted' && (
              <p className="text-xs text-ink-faint">
                If no prompt appears, open your phone's Settings → Apps → Tally → Notifications and turn them on.
              </p>
            )}

            {isNative && permission === 'granted' && native?.exactAlarms === 'denied' && (
              <div className="rounded-control border border-warning/40 bg-warning/10 p-3">
                <p className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  <AlertTriangle size={14} className="text-warning" /> Exact timing is off
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  Android may deliver reminders several minutes late. Allow "Alarms &amp; reminders" for Tally to fix
                  it.
                </p>
                <Button size="sm" variant="secondary" className="mt-2" onClick={handleFixExactAlarms}>
                  Open setting
                </Button>
              </div>
            )}

            {isNative && permission === 'granted' && native && (
              <p className="text-xs text-ink-muted">
                {native.scheduledCount === 0 || !native.next
                  ? 'No reminders scheduled right now.'
                  : `${native.scheduledCount} reminder${native.scheduledCount === 1 ? '' : 's'} scheduled. Next: ${native.next.title} — ${formatWhen(native.next.at)}`}
              </p>
            )}

            <label className="flex items-center justify-between rounded-control border border-border p-3 text-sm text-ink">
              Exam reminders
              <input
                type="checkbox"
                checked={prefs.exams}
                onChange={(e) => updateSettings({ notificationPrefs: { ...prefs, exams: e.target.checked } })}
                className="h-4 w-4 rounded accent-accent"
              />
            </label>
            <label className="flex items-center justify-between rounded-control border border-border p-3 text-sm text-ink">
              Task reminders
              <input
                type="checkbox"
                checked={prefs.tasks}
                onChange={(e) => updateSettings({ notificationPrefs: { ...prefs, tasks: e.target.checked } })}
                className="h-4 w-4 rounded accent-accent"
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-control border border-border p-3 text-sm text-ink">
              <span>
                Evening-before exam heads-up
                <span className="block text-xs text-ink-faint">8:00 PM the night before each exam</span>
              </span>
              <input
                type="checkbox"
                checked={prefs.examEveningBefore !== false}
                onChange={(e) => updateSettings({ notificationPrefs: { ...prefs, examEveningBefore: e.target.checked } })}
                className="h-4 w-4 shrink-0 rounded accent-accent"
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-control border border-border p-3 text-sm text-ink">
              <span>
                Morning briefing
                <span className="block text-xs text-ink-faint">8:00 AM on days with an exam or tasks due</span>
              </span>
              <input
                type="checkbox"
                checked={prefs.morningBriefing !== false}
                onChange={(e) => updateSettings({ notificationPrefs: { ...prefs, morningBriefing: e.target.checked } })}
                className="h-4 w-4 shrink-0 rounded accent-accent"
              />
            </label>

            {permission === 'granted' && (
              <Button size="sm" variant="secondary" onClick={handleTestNotification}>
                Send a test notification
              </Button>
            )}

            <p className="text-xs text-ink-faint">
              {isNative
                ? 'The two automatic reminders above need no setup. You can also set a reminder time on any exam or task. Android delivers them even when Tally is closed.'
                : "Set a reminder time on any exam or task. In a browser, this can only notify you while the tab or installed app is actually open — there's no way for a website to wake up on its own to fire a notification while fully closed."}
            </p>
          </>
        )}
      </GlassCard>

      <GlassCard className="p-5">
        <Button variant="danger" size="sm" onClick={() => setResetConfirmOpen(true)}>
          Reset settings to default
        </Button>
      </GlassCard>

      <p className="pb-2 text-center text-xs text-ink-faint">{BUILD_LABEL}</p>

      <ConfirmDialog
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={resetSettings}
        title="Reset all settings?"
        description="Theme, dashboard layout and preferences go back to default. Your name, exams, tasks and configs are kept."
        confirmLabel="Reset"
      />

      <ConfirmDialog
        open={signOutConfirmOpen}
        onClose={() => setSignOutConfirmOpen(false)}
        onConfirm={signOut}
        title="Sign out?"
        description="You'll need to sign in again to see your synced exams and tasks on this device."
        confirmLabel="Sign out"
      />
    </div>
  );
}
