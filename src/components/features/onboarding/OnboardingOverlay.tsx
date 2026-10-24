import { useState } from 'react';
import { FileSpreadsheet, ListChecks, SlidersHorizontal, CalendarDays, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { PopupFrame } from '@/components/ui/Popup';
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

/** Lets the closing animation play before the "seen" flag is saved (which removes this popup). */
const CLOSE_MS = 340;

export function OnboardingOverlay() {
  const { settings, updateSettings, loaded } = useSettingsStore();
  const [closing, setClosing] = useState(false);

  // Wait until the real saved settings are known. Before that, `settings` only
  // holds placeholder defaults (where "intro seen" is false), which is what made
  // this popup appear on every launch even though it had already been dismissed.
  if (!loaded || settings.onboardingCompleted) return null;

  function finish() {
    if (closing) return;
    setClosing(true);
    window.setTimeout(() => updateSettings({ onboardingCompleted: true }), CLOSE_MS);
  }

  return (
    <PopupFrame open={!closing} labelledBy="onboarding-title" className="max-w-md">
      <div className="p-6">
        <div className="flex items-center gap-2.5">
          <TallyMark size={30} />
          <span className="font-display text-lg font-semibold text-ink">
            Tally<span className="text-accent">.</span>
          </span>
        </div>

        <p className="eyebrow mt-6">First time here</p>
        <h1 id="onboarding-title" className="mt-2 font-serif text-[2.6rem] leading-[0.95] tracking-tight text-ink">
          Welcome to Tally
        </h1>
        <p className="mt-3 text-sm text-ink-muted">
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
      </div>
    </PopupFrame>
  );
}
