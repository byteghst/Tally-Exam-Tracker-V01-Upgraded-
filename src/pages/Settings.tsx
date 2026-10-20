import { useCallback, useEffect, useState } from 'react';
import { ChevronUp, ChevronDown, Bell, BellOff, LogOut, AlertTriangle } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Switch, ToggleRow } from '@/components/ui/Switch';
import { Rise, Section, Stagger } from '@/components/motion/Reveal';
import { UpdateCard } from '@/components/features/update/UpdateCard';
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

/** A row of mutually exclusive options: the chosen one is filled with the accent. */
function Choice<T extends string>({
  options,
  value,
  onChange
}: {
  options: T[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onChange(option)}
          aria-pressed={value === option}
          className={clsx(
            'rounded-full px-4 py-2 text-sm font-semibold capitalize transition-colors duration-200',
            value === option ? 'bg-accent text-accent-on' : 'bg-ink/[0.06] text-ink-muted hover:text-ink'
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
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
    <Stagger className="space-y-8 py-8">
      <Rise as="header">
        <p className="eyebrow">Preferences</p>
        <h1 className="mt-3 font-serif text-6xl leading-[0.9] tracking-tight text-ink">Settings</h1>
      </Rise>

      <Section label="Account" card>
        <p className="font-serif text-2xl italic leading-snug text-ink">{user?.email}</p>
        <p className="mt-2 text-sm text-ink-muted">
          Your exams, tasks and configs sync to every device you sign in on.
        </p>
        <Button variant="secondary" size="sm" className="mt-4" onClick={() => setSignOutConfirmOpen(true)}>
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </Section>

      <Section label="Personal" card>
        <div className="space-y-4">
          <Input
            label="Your name (optional)"
            value={settings.userName ?? ''}
            onChange={(e) => updateSettings({ userName: e.target.value || undefined })}
            placeholder="Used for the Dashboard greeting"
          />
          <p className="-mt-2 text-xs text-ink-faint">
            Saved to your account, so it stays the same after app updates and on all your devices.
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
        </div>
      </Section>

      <Section label="Appearance" card>
        <Choice options={THEME_OPTIONS} value={settings.theme} onChange={(theme) => updateSettings({ theme })} />
      </Section>

      <Section label="Dashboard" card>
        <div className="space-y-1.5">
          <ToggleRow
            label="Momentum tracker"
            checked={settings.streaksEnabled}
            onChange={(streaksEnabled) => updateSettings({ streaksEnabled })}
          />
          <ToggleRow
            label="Daily Mission"
            checked={settings.showDailyMission}
            onChange={(showDailyMission) => updateSettings({ showDailyMission })}
          />
        </div>

        <p className="mt-4 text-xs text-ink-faint">
          The next-exam countdown always shows above the widgets below and can't be hidden or reordered.
        </p>

        <p className="eyebrow mt-6">Density</p>
        <div className="mt-3">
          <Choice
            options={DENSITY_OPTIONS}
            value={settings.density}
            onChange={(density) => updateSettings({ density })}
          />
        </div>

        <p className="eyebrow mt-6">Widgets</p>
        <ul className="mt-3 space-y-1.5">
          {widgetItems.map((w, i) => (
            <li key={w.id} className="flex items-center gap-2 rounded-control bg-ink/[0.04] py-2.5 pl-4 pr-3">
              <span className="min-w-0 flex-1 text-base text-ink">{WIDGET_LABELS[w.id]}</span>
              <button
                onClick={() => moveWidget(i, -1)}
                disabled={i === 0}
                aria-label={`Move ${WIDGET_LABELS[w.id]} up`}
                className="rounded-full p-1.5 text-ink-muted hover:bg-ink/5 hover:text-ink disabled:opacity-30"
              >
                <ChevronUp size={16} />
              </button>
              <button
                onClick={() => moveWidget(i, 1)}
                disabled={i === widgetItems.length - 1}
                aria-label={`Move ${WIDGET_LABELS[w.id]} down`}
                className="rounded-full p-1.5 text-ink-muted hover:bg-ink/5 hover:text-ink disabled:opacity-30"
              >
                <ChevronDown size={16} />
              </button>
              <Switch checked={w.visible} onChange={() => toggleWidget(w.id)} label={`Show ${WIDGET_LABELS[w.id]}`} />
            </li>
          ))}
        </ul>
      </Section>

      <Section label="Notifications" card>
        {permission === 'unsupported' ? (
          <p className="text-sm text-ink-muted">Notifications aren't supported in this browser.</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-base text-ink">
                {permission === 'granted' ? (
                  <Bell size={18} className="text-forest" />
                ) : (
                  <BellOff size={18} className="text-ink-faint" />
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
              <p className="mt-2 text-xs text-ink-faint">
                If no prompt appears, open your phone's Settings → Apps → Tally → Notifications and turn them on.
              </p>
            )}

            {isNative && permission === 'granted' && native?.exactAlarms === 'denied' && (
              <div className="mt-4 rounded-control bg-saffron/10 p-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                  <AlertTriangle size={14} className="text-saffron" /> Exact timing is off
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
              <p className="mt-3 text-xs text-ink-muted">
                {native.scheduledCount === 0 || !native.next
                  ? 'No reminders scheduled right now.'
                  : `${native.scheduledCount} reminder${native.scheduledCount === 1 ? '' : 's'} scheduled. Next: ${native.next.title} — ${formatWhen(native.next.at)}`}
              </p>
            )}

            <div className="mt-4 space-y-1.5">
              <ToggleRow
                label="Exam reminders"
                checked={prefs.exams}
                onChange={(exams) => updateSettings({ notificationPrefs: { ...prefs, exams } })}
              />
              <ToggleRow
                label="Task reminders"
                checked={prefs.tasks}
                onChange={(tasks) => updateSettings({ notificationPrefs: { ...prefs, tasks } })}
              />
              <ToggleRow
                label="Evening-before exam heads-up"
                hint="8:00 PM the night before each exam"
                checked={prefs.examEveningBefore !== false}
                onChange={(examEveningBefore) => updateSettings({ notificationPrefs: { ...prefs, examEveningBefore } })}
              />
              <ToggleRow
                label="Morning briefing"
                hint="8:00 AM on days with an exam or tasks due"
                checked={prefs.morningBriefing !== false}
                onChange={(morningBriefing) => updateSettings({ notificationPrefs: { ...prefs, morningBriefing } })}
              />
            </div>

            {permission === 'granted' && (
              <Button size="sm" variant="secondary" className="mt-4" onClick={handleTestNotification}>
                Send a test notification
              </Button>
            )}

            <p className="mt-4 text-xs text-ink-faint">
              {isNative
                ? 'The two automatic reminders above need no setup. You can also set a reminder time on any exam or task. Android delivers them even when Tally is closed.'
                : "Set a reminder time on any exam or task. In a browser, this can only notify you while the tab or installed app is actually open — there's no way for a website to wake up on its own to fire a notification while fully closed."}
            </p>
          </>
        )}
      </Section>

      <UpdateCard />

      <Rise>
        <Button variant="secondary" size="sm" className="text-danger" onClick={() => setResetConfirmOpen(true)}>
          Reset settings to default
        </Button>
        <p className="mt-8 text-center text-xs text-ink-faint">{BUILD_LABEL}</p>
      </Rise>

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
    </Stagger>
  );
}
