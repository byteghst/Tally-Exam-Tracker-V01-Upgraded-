import { useMemo, useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { examFormSchema, type ExamFormValues } from '@/lib/validation/examSchema';
import { useExamStore } from '@/store/examStore';
import { useExamConfigStore } from '@/store/examConfigStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUIStore } from '@/store/uiStore';
import { calculateScore } from '@/lib/scoring';
import { todayISO } from '@/lib/dates';
import type { Exam, ExamStatus, ExamType } from '@/types';

interface ExamFormProps {
  open: boolean;
  onClose: () => void;
  exam?: Exam;
  defaultDate?: string;
  defaultType?: ExamType;
}

type FieldErrors = Record<string, string | undefined>;

const TYPE_LABELS: Record<ExamType, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
const STATUS_LABELS: Record<ExamStatus, string> = {
  upcoming: 'Upcoming',
  completed: 'Completed',
  missed: 'Missed'
};

function toFormState(exam: Exam | undefined, defaultDate: string | undefined, defaultType: ExamType) {
  return {
    configId: exam?.configId ?? '',
    name: exam?.name ?? '',
    type: exam?.type ?? defaultType,
    date: exam?.date ?? defaultDate ?? todayISO(),
    startTime: exam?.startTime ?? '',
    endTime: exam?.endTime ?? '',
    status: exam?.status ?? ('upcoming' as ExamStatus),

    mcqCount: exam?.mcqCount?.toString() ?? '',
    mcqMarksEach: exam?.mcqMarksEach?.toString() ?? '1',
    writtenCount: exam?.writtenCount?.toString() ?? '',
    writtenMarksEach: exam?.writtenMarksEach?.toString() ?? '',
    negativeMarkPerWrong: exam?.negativeMarkPerWrong?.toString() ?? '0',

    mcqCorrect: exam?.mcqCorrect?.toString() ?? '',
    mcqWrong: exam?.mcqWrong?.toString() ?? '',
    mcqUnanswered: exam?.mcqUnanswered?.toString() ?? '',
    writtenMarksObtained: exam?.writtenMarksObtained?.toString() ?? '',
    manualScoreOverride: exam?.manualScoreOverride?.toString() ?? '',
    rank: exam?.rank?.toString() ?? '',
    participants: exam?.participants?.toString() ?? '',
    notes: exam?.notes ?? '',
    reminderMinutesBefore: exam?.reminderMinutesBefore?.toString() ?? '',

    // whether the structure fields are locked to the chosen config's numbers
    // or unlocked for a one-off, manual override
    unlockedStructure: !exam?.configId
  };
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
      mcqUnanswered: form.mcqUnanswered === '' ? undefined : Number(form.mcqUnanswered),
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
      endTime: form.endTime,
      status: form.status,
      mcqCount: Number(form.mcqCount || 0),
      mcqMarksEach: Number(form.mcqMarksEach || 0),
      writtenCount: Number(form.writtenCount || 0),
      writtenMarksEach: Number(form.writtenMarksEach || 0),
      negativeMarkPerWrong: Number(form.negativeMarkPerWrong || 0),
      mcqCorrect: form.mcqCorrect === '' ? '' : Number(form.mcqCorrect),
      mcqWrong: form.mcqWrong === '' ? '' : Number(form.mcqWrong),
      mcqUnanswered: form.mcqUnanswered === '' ? '' : Number(form.mcqUnanswered),
      writtenMarksObtained: form.writtenMarksObtained === '' ? '' : Number(form.writtenMarksObtained),
      manualScoreOverride: form.manualScoreOverride === '' ? '' : Number(form.manualScoreOverride),
      rank: form.rank === '' ? '' : Number(form.rank),
      participants: form.participants === '' ? '' : Number(form.participants),
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
    const payload = {
      configId: v.configId || null,
      name: v.name.trim(),
      type: v.type,
      date: v.date,
      startTime: v.startTime || null,
      endTime: v.endTime || null,
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
      rank: v.rank === '' ? null : v.rank,
      participants: v.participants === '' ? null : v.participants,
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
      <div className="space-y-4">
        <Select
          label="Config (optional)"
          value={form.configId}
          onChange={(e) => handleConfigChange(e.target.value)}
        >
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

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium text-ink-muted">Type</legend>
          <div className="flex gap-2">
            {(['daily', 'weekly', 'monthly'] as ExamType[]).map((t) => {
              const disabled = !!availableTypesForConfig && !availableTypesForConfig.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleTypeChange(t)}
                  aria-pressed={form.type === t}
                  className={`flex-1 rounded-control border px-3 py-2 text-sm font-medium ${
                    form.type === t
                      ? 'border-accent bg-accent/15 text-accent'
                      : disabled
                        ? 'border-border/50 text-ink-faint'
                        : 'border-border text-ink-muted'
                  }`}
                >
                  {TYPE_LABELS[t]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-3 gap-3">
          <Input label="Date" type="date" value={form.date} onChange={(e) => set('date', e.target.value)} error={errors.date} />
          <Input label="Start" type="time" value={form.startTime} onChange={(e) => set('startTime', e.target.value)} />
          <Input label="End" type="time" value={form.endTime} onChange={(e) => set('endTime', e.target.value)} />
        </div>

        <fieldset className="flex flex-col gap-1.5">
          <legend className="text-sm font-medium text-ink-muted">Status</legend>
          <div className="flex flex-wrap gap-2">
            {(['upcoming', 'completed', 'missed'] as ExamStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => set('status', s)}
                aria-pressed={form.status === s}
                className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                  form.status === s ? 'bg-accent text-white' : 'bg-white/5 text-ink-muted'
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="space-y-3 rounded-control border border-border p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-ink">Scoring structure</p>
            {form.configId && (
              <label className="flex items-center gap-1.5 text-xs text-ink-muted">
                <input
                  type="checkbox"
                  checked={form.unlockedStructure}
                  onChange={(e) => set('unlockedStructure', e.target.checked)}
                  className="h-3.5 w-3.5 rounded accent-accent"
                />
                Override for this exam
              </label>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="MCQ questions"
              type="number"
              inputMode="numeric"
              disabled={!!form.configId && !form.unlockedStructure}
              value={form.mcqCount}
              onChange={(e) => set('mcqCount', e.target.value)}
            />
            <Input
              label="Marks per MCQ"
              type="number"
              step="0.01"
              inputMode="decimal"
              disabled={!!form.configId && !form.unlockedStructure}
              value={form.mcqMarksEach}
              onChange={(e) => set('mcqMarksEach', e.target.value)}
            />
            <Input
              label="Written questions"
              type="number"
              inputMode="numeric"
              disabled={!!form.configId && !form.unlockedStructure}
              value={form.writtenCount}
              onChange={(e) => set('writtenCount', e.target.value)}
            />
            <Input
              label="Marks per written Q"
              type="number"
              step="0.01"
              inputMode="decimal"
              disabled={!!form.configId && !form.unlockedStructure}
              value={form.writtenMarksEach}
              onChange={(e) => set('writtenMarksEach', e.target.value)}
            />
            <div className="col-span-2">
              <Input
                label="Negative mark / wrong"
                type="number"
                step="0.01"
                inputMode="decimal"
                disabled={!!form.configId && !form.unlockedStructure}
                value={form.negativeMarkPerWrong}
                onChange={(e) => set('negativeMarkPerWrong', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-control border border-border p-3">
          <p className="text-sm font-medium text-ink">Result</p>
          <div className="grid grid-cols-3 gap-3">
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
            <Input
              label="Unanswered"
              type="number"
              inputMode="numeric"
              value={form.mcqUnanswered}
              onChange={(e) => set('mcqUnanswered', e.target.value)}
              error={errors.mcqUnanswered}
            />
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

          {preview && (
            <div className="rounded-control bg-accent/10 p-3 text-sm">
              <p className="font-semibold text-accent">
                {preview.finalScore} / {preview.totalMarks}
                {preview.percentage !== null && ` (${preview.percentage}%)`}
              </p>
              <p className="text-xs text-ink-muted">
                MCQ {preview.mcqScore} + Written {preview.writtenScore}
                {preview.isManualOverride && ' — using manual override'}
              </p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Rank (optional)" type="number" inputMode="numeric" value={form.rank} onChange={(e) => set('rank', e.target.value)} error={errors.rank} />
          <Input
            label="Participants (optional)"
            type="number"
            inputMode="numeric"
            value={form.participants}
            onChange={(e) => set('participants', e.target.value)}
          />
        </div>

        <Input
          label="Reminder (min before)"
          type="number"
          inputMode="numeric"
          value={form.reminderMinutesBefore}
          onChange={(e) => set('reminderMinutesBefore', e.target.value)}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="exam-notes" className="text-sm font-medium text-ink-muted">
            Notes (optional)
          </label>
          <textarea
            id="exam-notes"
            rows={3}
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
            className="rounded-control border border-border bg-surface px-3 py-2 text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
      </div>
    </Sheet>
  );
}
