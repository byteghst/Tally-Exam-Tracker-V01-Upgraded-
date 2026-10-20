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
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-ink/50 p-4" role="presentation">
      <GlassCard
        role="dialog"
        aria-modal="true"
        aria-labelledby="onboarding-title"
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto p-6 shadow-sheet"
      >
        <div className="flex items-center gap-2">
          <TallyMark size={26} className="text-ink" />
          <span className="font-display text-lg font-semibold text-ink">
            Tally<span className="text-accent">.</span>
          </span>
        </div>

        <h1 id="onboarding-title" className="mt-4 font-serif text-4xl leading-none tracking-tight text-ink">
          Welcome to Tally
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Your exams and tasks are entered manually and synced securely to your account.
        </p>

        <ul className="mt-5 space-y-2">
          {HIGHLIGHTS.map((h) => (
            <li key={h.title} className="flex items-start gap-3 rounded-control bg-ink/[0.04] px-3 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-accent">
                <h.icon size={18} />
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">{h.title}</p>
                <p className="text-sm text-ink-muted">{h.body}</p>
              </div>
            </li>
          ))}
        </ul>

        <Button onClick={finish} size="lg" className="mt-6 w-full">
          Get started
        </Button>
      </GlassCard>
    </div>,
    document.body
  );
}
