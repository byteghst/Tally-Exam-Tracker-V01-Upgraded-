import { FileSpreadsheet, ListChecks, SlidersHorizontal, CalendarDays, RefreshCw } from 'lucide-react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/Button';
import { GlassCard } from '@/components/ui/GlassCard';
import { TallyMark } from '@/components/ui/TallyMark';
import { useSettingsStore } from '@/store/settingsStore';

const HIGHLIGHTS = [
  {
    icon: SlidersHorizontal,
    title: 'Exam configs',
    body: "Set up a course's MCQ + written scoring once — daily, weekly, monthly — and reuse it for every exam."
  },
  {
    icon: FileSpreadsheet,
    title: 'Exams',
    body: 'Add an exam, pick a config, and just type in the result — the math is done for you.'
  },
  { icon: ListChecks, title: 'Tasks', body: 'Plan study sessions, including ones that repeat on a schedule.' },
  { icon: CalendarDays, title: 'Calendar', body: 'See every exam and task on one shared calendar.' },
  { icon: RefreshCw, title: 'Synced', body: 'Everything you enter here shows up instantly on your other signed-in devices too.' }
];

export function OnboardingOverlay() {
  const { settings, updateSettings, loaded } = useSettingsStore();

  // Wait until the real saved settings are known. Before that, `settings` only
  // holds placeholder defaults (where "intro seen" is false), which is what made
  // this popup appear on every launch even though it had already been dismissed.
  if (!loaded || settings.onboardingCompleted) return null;

  function finish() {
    updateSettings({ onboardingCompleted: true });
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" role="presentation">
      <GlassCard
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="w-full max-w-md p-6"
      >
        <div className="flex items-center gap-2">
          <TallyMark size={26} className="text-ink" />
          <span className="font-display text-lg font-semibold text-ink">
            Tally<span className="text-accent">.</span>
          </span>
        </div>

        <h1 id="onboarding-title" className="mt-4 font-display text-xl font-semibold text-ink">
          Welcome to Tally
        </h1>
        <p className="mt-1 text-sm text-ink-muted">
          Your exams and tasks are entered manually and synced securely to your account.
        </p>

        <ul className="mt-5 space-y-4">
          {HIGHLIGHTS.map((h) => (
            <li key={h.title} className="flex items-start gap-3">
              <h.icon size={20} className="mt-0.5 shrink-0 text-accent" />
              <div>
                <p className="text-sm font-medium text-ink">{h.title}</p>
                <p className="text-sm text-ink-muted">{h.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <Button onClick={finish} className="mt-6 w-full">
          Get started
        </Button>
      </GlassCard>
    </div>,
    document.body
  );
}
