import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sheet } from '@/components/ui/Sheet';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Segmented } from '@/components/ui/Segmented';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { examFormSchema, type ExamFormValues } from '@/lib/validation/examSchema';
import { useExamStore } from '@/store/examStore';
import { useExamConfigStore } from '@/store/examConfigStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUIStore } from '@/store/uiStore';
import { calculateScore } from '@/lib/scoring';
import { todayISO } from '@/lib/dates';
import { EASE_OUT } from '@/lib/motion';
import type { Exam, ExamStatus, ExamType } from '@/types';

interface ExamFormProps {
  open: boolean;
  onClose: () => void;
  exam?: Exam;
  defaultDate?: string;
  defaultType?: ExamType;
}

type FieldErrors = Record<string, string | undefined>;

// Same colours as the dots on the Exams screen: daily = persimmon, weekly = saffron, monthly = forest.
const TYPE_OPTIONS = [
  { value: 'daily' as ExamType, label: 'Daily', color: 'bg-accent' },
  { value: 'weekly' as ExamType, label: 'Weekly', color: 'bg-saffron' },
  { value: 'monthly' as ExamType, label: 'Monthly', color: 'bg-forest' }
];

const STATUS_OPTIONS = [
  { value: 'upcoming' as ExamStatus, label: 'Upcoming', color: 'bg-saffron' },
  { value: 'completed' as ExamStatus, label: 'Completed', color: 'bg-forest' },
  { value: 'missed' as ExamStatus, label: 'Missed', color: 'bg-danger' }
];

function toFormState(exam: Exam | undefined, defaultDate: string | undefined, defaultType: ExamType) {
  return {
    configId: exam?.configId ?? '',
    name: exam?.name ?? '',
    type: exam?.type ?? defaultType,
    date: exam?.date ?? defaultDate ?? todayISO(),
    startTime: exam?.startTime ?? '',
    status: exam?.status ?? ('upcoming' as ExamStatus),

    mcqCount: exam?.mcqCount?.toString() ?? '',
    mcqMarksEach: exam?.mcqMarksEach?.toString() ?? '1',
    writtenCount: exam?.writtenCount?.toString() ?? '',
    writtenMarksEach: exam?.writtenMarksEach?.toString() ?? '',
    negativeMarkPerWrong: exam?.negativeMarkPerWrong?.toString() ?? '0',

    mcqCorrect: exam?.mcqCorrect?.toString() ?? '',
    mcqWrong: exam?.mcqWrong?.toString() ?? '',
    writtenMarksObtained: exam?.writtenMarksObtained?.toString() ?? '',
    manualScoreOverride: exam?.manualScoreOverride?.toString() ?? '',
    notes: exam?.notes ?? '',
    reminderMinutesBefore: exam?.reminderMinutesBefore?.toString() ?? '',

    // whether the structure fields are locked to the chosen config's numbers
    // or unlocked for a one-off, manual override
    unlockedStructure: !exam?.configId
  };
}

/** A small label that starts a new group of fields. Spacing separates it from the group above; no line. */
function SectionHead({ children }: { children: string }) {
  return <p className="eyebrow pt-4">{children}</p>;
}

export function ExamForm({ open, onClose, exam, defaultDate, defaultType }: ExamFormProps) {
  const { addExam, updateExam } = useExamStore();
  const { configs } = useExamConfigStore();
  const { settings } = useSettingsStore();
  const { pushToast } = useUIStore();
  const isEdit = !!exam;

  const [form, setForm] = useState(() => toFormState(exam, defaultDate, defaultType ?? settings.defaultExamType));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [lastId, setLastId] = useState(exam?.id);

  if (exam?.id !== lastId || (!exam && lastId)) {
    setLastId(exam?.id);
    setForm(toFormState(exam, defaultDate, defaultType ?? settings.defaultExamType));
    setErrors({});
  }

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const selectedConfig = configs.find((c) => c.id === form.configId);
  const availableTypesForConfig = useMemo(
    () => selectedConfig?.types.map((t) => t.type) ?? null,
    [selectedConfig]
  );

  function applyConfigStructure(configId: string, type: ExamType) {
    const config = configs.find((c) => c.id === configId);
    const typeSetting = config?.types.find((t) => t.type === type);
    if (!config || !typeSetting) return;
    setForm((f) => ({
      ...f,
      mcqCount: typeSetting.mcqCount.toString(),
      mcqMarksEach: typeSetting.mcqMarksEach.toString(),
      writtenCount: typeSetting.writtenCount.toString(),
      writtenMarksEach: typeSetting.writtenMarksEach.toString(),
      negativeMarkPerWrong: config.negativeMarkPerWrong.toString(),
      unlockedStructure: false
    }));
  }

  function handleConfigChange(configId: string) {
    set('configId', configId);
    if (!configId) {
      set('unlockedStructure', true);
      return;
    }
    const config = configs.find((c) => c.id === configId);
    const firstType = config?.types[0]?.type;
    if (firstType) {
      set('type', firstType);
      applyConfigStructure(configId, firstType);
    }
  }

  function handleTypeChange(type: ExamType) {
    set('type', type);
    if (form.configId) applyConfigStructure(form.configId, type);
  }

  // Unanswered is derived, never typed in directly: whatever's left after
  // correct + wrong is however many were left blank on the actual sheet.
  const mcqCountNum = Number(form.mcqCount || 0);
  const mcqCorrectNum = form.mcqCorrect === '' ? 0 : Number(form.mcqCorrect);
  const mcqWrongNum = form.mcqWrong === '' ? 0 : Number(form.mcqWrong);
  const unansweredComputed = Math.max(mcqCountNum - mcqCorrectNum - mcqWrongNum, 0);

  const preview = useMemo(() => {
    const mcqCount = Number(form.mcqCount || 0);
    const mcqMarksEach = Number(form.mcqMarksEach || 0);
    const writtenCount = Number(form.writtenCount || 0);
    const writtenMarksEach = Number(form.writtenMarksEach || 0);
    const negativeMarkPerWrong = Number(form.negativeMarkPerWrong || 0);
    if (mcqCount === 0 && writtenCount === 0) return null;
    return calculateScore({
      mcqCount,
      mcqMarksEach,
      writtenCount,
      writtenMarksEach,
      negativeMarkPerWrong,
      mcqCorrect: form.mcqCorrect === '' ? undefined : Number(form.mcqCorrect),
      mcqWrong: form.mcqWrong === '' ? undefined : Number(form.mcqWrong),
      writtenMarksObtained: form.writtenMarksObtained === '' ? undefined : Number(form.writtenMarksObtained),
      manualScore: form.manualScoreOverride === '' ? undefined : Number(form.manualScoreOverride)
    });
  }, [form]);

  async function handleSubmit() {
    const toValidate: ExamFormValues = {
      name: form.name,
      type: form.type,
      configId: form.configId,
      date: form.date,
      startTime: form.startTime,
      status: form.status,
      mcqCount: Number(form.mcqCount || 0),
      mcqMarksEach: Number(form.mcqMarksEach || 0),
      writtenCount: Number(form.writtenCount || 0),
      writtenMarksEach: Number(form.writtenMarksEach || 0),
      negativeMarkPerWrong: Number(form.negativeMarkPerWrong || 0),
      mcqCorrect: form.mcqCorrect === '' ? '' : Number(form.mcqCorrect),
      mcqWrong: form.mcqWrong === '' ? '' : Number(form.mcqWrong),
      mcqUnanswered: unansweredComputed,
      writtenMarksObtained: form.writtenMarksObtained === '' ? '' : Number(form.writtenMarksObtained),
      manualScoreOverride: form.manualScoreOverride === '' ? '' : Number(form.manualScoreOverride),
      notes: form.notes,
      reminderMinutesBefore: form.reminderMinutesBefore === '' ? '' : Number(form.reminderMinutesBefore)
    };

    const result = examFormSchema.safeParse(toValidate);
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path.join('.');
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setSubmitting(true);
    const v = result.data;
    // Blank optional fields become `null` here — the store treats `null` as
    // "clear this field" and plain `undefined`/an omitted key as "leave it
    // alone". A real 0 is a normal number and passes straight through.
    // rank/participants are intentionally left out entirely (not sent as
    // null) — this form no longer collects them, so any value an exam
    // already had is left untouched rather than cleared.
    const payload = {
      configId: v.configId || null,
      name: v.name.trim(),
      type: v.type,
      date: v.date,
      startTime: v.startTime || null,
      status: v.status,
      mcqCount: v.mcqCount,
      mcqMarksEach: v.mcqMarksEach,
      writtenCount: v.writtenCount,
      writtenMarksEach: v.writtenMarksEach,
      negativeMarkPerWrong: v.negativeMarkPerWrong,
      mcqCorrect: v.mcqCorrect === '' ? null : v.mcqCorrect,
      mcqWrong: v.mcqWrong === '' ? null : v.mcqWrong,
      mcqUnanswered: v.mcqUnanswered === '' ? null : v.mcqUnanswered,
      writtenMarksObtained: v.writtenMarksObtained === '' ? null : v.writtenMarksObtained,
      manualScoreOverride: v.manualScoreOverride === '' ? null : v.manualScoreOverride,
      notes: v.notes?.trim() ? v.notes.trim() : null,
      reminderMinutesBefore: v.reminderMinutesBefore === '' ? null : v.reminderMinutesBefore
    };

    try {
      if (isEdit && exam) {
        await updateExam(exam.id, payload);
        pushToast('Exam updated');
      } else {
        await addExam(payload);
        pushToast('Exam added');
      }
      onClose();
    } catch {
      pushToast('Something went wrong saving this exam. Please try again.', undefined, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const structureLocked = !!form.configId && !form.unlockedStructure;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit exam' : 'Add exam'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {isEdit ? 'Save changes' : 'Add exam'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <Select label="Config (optional)" value={form.configId} onChange={(e) => handleConfigChange(e.target.value)}>
          <option value="">Custom (enter numbers manually)</option>
          {configs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        <Input
          label="Exam name"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          error={errors.name}
          placeholder="e.g. Weekly Exam #6"
        />

        <Segmented
          label="Type"
          options={TYPE_OPTIONS.map((o) => ({
            ...o,
            disabled: !!availableTypesForConfig && !availableTypesForConfig.includes(o.value)
          }))}
          value={form.type}
          onChange={handleTypeChange}
        />

        <div className="grid grid-cols-2 gap-5">
          <Input label="Date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} error={errors.date} />
          <Input label="Start" type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} />
        </div>

        <Segmented label="Status" options={STATUS_OPTIONS} value={form.status} onChange={(s) => set('status', s)} />

        <SectionHead>Scoring structure</SectionHead>
        {form.configId && (
          <div className="-mt-2 flex items-center justify-between gap-4 rounded-control bg-ink/[0.04] px-4 py-3">
            <p className="text-sm text-ink-muted">Numbers come from the config.</p>
            <div className="flex items-center gap-3">
              <span className="text-sm text-ink">Override</span>
              <Switch
                checked={form.unlockedStructure}
                onChange={(checked) => set('unlockedStructure', checked)}
                label="Override the config numbers for this exam"
              />
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-x-5 gap-y-5">
          <Input
            label="MCQ questions"
            type="number"
            inputMode="numeric"
            disabled={structureLocked}
            value={form.mcqCount}
            onChange={(e) => set('mcqCount', e.target.value)}
            className="disabled:opacity-50"
          />
          <Input
            label="Marks per MCQ"
            type="number"
            step="0.01"
            inputMode="decimal"
            disabled={structureLocked}
            value={form.mcqMarksEach}
            onChange={(e) => set('mcqMarksEach', e.target.value)}
            className="disabled:opacity-50"
          />
          <Input
            label="Written questions"
            type="number"
            inputMode="numeric"
            disabled={structureLocked}
            value={form.writtenCount}
            onChange={(e) => set('writtenCount', e.target.value)}
            className="disabled:opacity-50"
          />
          <Input
            label="Marks per written Q"
            type="number"
            step="0.01"
            inputMode="decimal"
            disabled={structureLocked}
            value={form.writtenMarksEach}
            onChange={(e) => set('writtenMarksEach', e.target.value)}
            className="disabled:opacity-50"
          />
          <div className="col-span-2">
            <Input
              label="Negative mark / wrong"
              type="number"
              step="0.01"
              inputMode="decimal"
              disabled={structureLocked}
              value={form.negativeMarkPerWrong}
              onChange={(e) => set('negativeMarkPerWrong', e.target.value)}
              className="disabled:opacity-50"
            />
          </div>
        </div>

        <SectionHead>Result</SectionHead>
        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Correct"
            type="number"
            inputMode="numeric"
            value={form.mcqCorrect}
            onChange={(e) => set('mcqCorrect', e.target.value)}
            error={errors.mcqCorrect}
          />
          <Input
            label="Wrong"
            type="number"
            inputMode="numeric"
            value={form.mcqWrong}
            onChange={(e) => set('mcqWrong', e.target.value)}
            error={errors.mcqWrong}
          />
          <Input label="Blank (auto)" type="number" inputMode="numeric" disabled value={unansweredComputed} className="opacity-60" />
        </div>
        <Input
          label="Written marks obtained"
          type="number"
          step="0.01"
          inputMode="decimal"
          value={form.writtenMarksObtained}
          onChange={(e) => set('writtenMarksObtained', e.target.value)}
          error={errors.writtenMarksObtained}
        />
        <Input
          label="Manual score override (optional)"
          type="number"
          step="0.01"
          inputMode="decimal"
          value={form.manualScoreOverride}
          onChange={(e) => set('manualScoreOverride', e.target.value)}
        />

        {/* Live score: appears as soon as there's a structure to score against. */}
        <AnimatePresence initial={false}>
          {preview && (
            <motion.div
              key="preview"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
              className="overflow-hidden"
            >
              <div className="rounded-card bg-accent-soft p-4">
                <p className="eyebrow !text-accent">Live score</p>
                <p className="mt-1 font-serif text-5xl leading-none tracking-tight text-ink">
                  {preview.finalScore}
                  <span className="text-ink-faint"> / {preview.totalMarks}</span>
                  {preview.percentage !== null && (
                    <span className="ml-3 text-3xl text-accent">{preview.percentage}%</span>
                  )}
                </p>
                <p className="mt-2 text-xs text-ink-muted">
                  MCQ {preview.mcqScore} + Written {preview.writtenScore}
                  {preview.isManualOverride && ' · using manual override'}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <SectionHead>Extras</SectionHead>
        <Input
          label="Reminder (min before)"
          type="number"
          inputMode="numeric"
          value={form.reminderMinutesBefore}
          onChange={(e) => set('reminderMinutesBefore', e.target.value)}
        />

        <Textarea
          label="Notes (optional)"
          rows={3}
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
        />
      </div>
    </Sheet>
  );
}
