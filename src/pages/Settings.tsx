import { useEffect, useState } from 'react';
import { ChevronUp, ChevronDown, Bell, BellOff, LogOut } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useSettingsStore } from '@/store/settingsStore';
import { useAuthStore } from '@/store/authStore';
import { normalizeLayout, WIDGET_LABELS } from '@/lib/dashboardWidgets';
import {
  requestNativeNotificationPermission,
  getNativeNotificationPermission,
  sendTestNativeNotification
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

export function Settings() {
  const { settings, updateSettings, resetSettings } = useSettingsStore();
  const { user, signOut } = useAuthStore();
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [permission, setPermission] = useState<PermissionState>('unknown');
  const isNative = Capacitor.isNativePlatform();

  useEffect(() => {
    if (isNative) {
      getNativeNotificationPermission().then((granted) => setPermission(granted ? 'granted' : 'denied'));
    } else if (isWebNotificationSupported()) {
      const p = getWebNotificationPermission();
      setPermission(p === 'granted' ? 'granted' : p === 'denied' ? 'denied' : 'unknown');
    } else {
      setPermission('unsupported');
    }
  }, [isNative]);

  async function handleEnableNotifications() {
    const granted = isNative ? await requestNativeNotificationPermission() : await requestWebNotificationPermission();
    setPermission(granted ? 'granted' : 'denied');
  }

  function handleTestNotification() {
    if (isNative) sendTestNativeNotification();
    else sendTestWebNotification();
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
            Focus Now
            <input
              type="checkbox"
              checked={settings.showFocusNow}
              onChange={(e) => updateSettings({ showFocusNow: e.target.checked })}
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

            <label className="flex items-center justify-between rounded-control border border-border p-3 text-sm text-ink">
              Exam reminders
              <input
                type="checkbox"
                checked={settings.notificationPrefs.exams}
                onChange={(e) =>
                  updateSettings({ notificationPrefs: { ...settings.notificationPrefs, exams: e.target.checked } })
                }
                className="h-4 w-4 rounded accent-accent"
              />
            </label>
            <label className="flex items-center justify-between rounded-control border border-border p-3 text-sm text-ink">
              Task reminders
              <input
                type="checkbox"
                checked={settings.notificationPrefs.tasks}
                onChange={(e) =>
                  updateSettings({ notificationPrefs: { ...settings.notificationPrefs, tasks: e.target.checked } })
                }
                className="h-4 w-4 rounded accent-accent"
              />
            </label>

            {permission === 'granted' && (
              <Button size="sm" variant="secondary" onClick={handleTestNotification}>
                Send a test notification
              </Button>
            )}

            <p className="text-xs text-ink-faint">
              {isNative
                ? "Set a reminder time on any exam or task and the app will notify you, even if it's closed."
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

      <ConfirmDialog
        open={resetConfirmOpen}
        onClose={() => setResetConfirmOpen(false)}
        onConfirm={resetSettings}
        title="Reset all settings?"
        description="Theme, dashboard layout, and every preference here goes back to default. Your exams, tasks and configs are not affected."
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
