import { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { examConfigFormSchema, type ExamConfigFormValues } from '@/lib/validation/examConfigSchema';
import { useExamConfigStore } from '@/store/examConfigStore';
import { useUIStore } from '@/store/uiStore';
import type { ExamConfig, ExamType } from '@/types';

interface ExamConfigFormProps {
  open: boolean;
  onClose: () => void;
  config?: ExamConfig;
}

type FieldErrors = Record<string, string | undefined>;

const TYPE_LABELS: Record<ExamType, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

function toTypeRow(config: ExamConfig | undefined, type: ExamType) {
  const existing = config?.types.find((t) => t.type === type);
  return {
    enabled: !!existing,
    mcqCount: existing?.mcqCount?.toString() ?? '',
    mcqMarksEach: existing?.mcqMarksEach?.toString() ?? '1',
    writtenCount: existing?.writtenCount?.toString() ?? '',
    writtenMarksEach: existing?.writtenMarksEach?.toString() ?? ''
  };
}

function toFormState(config?: ExamConfig) {
  return {
    name: config?.name ?? '',
    negativeMarkPerWrong: config?.negativeMarkPerWrong?.toString() ?? '0.25',
    daily: toTypeRow(config, 'daily'),
    weekly: toTypeRow(config, 'weekly'),
    monthly: toTypeRow(config, 'monthly')
  };
}

export function ExamConfigForm({ open, onClose, config }: ExamConfigFormProps) {
  const { addConfig, updateConfig } = useExamConfigStore();
  const { pushToast } = useUIStore();
  const isEdit = !!config;

  const [form, setForm] = useState(() => toFormState(config));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [lastId, setLastId] = useState(config?.id);

  if (config?.id !== lastId || (!config && lastId)) {
    setLastId(config?.id);
    setForm(toFormState(config));
    setErrors({});
  }

  function setTypeField(type: ExamType, key: keyof (typeof form)['daily'], value: string | boolean) {
    setForm((f) => ({ ...f, [type]: { ...f[type], [key]: value } }));
  }

  async function handleSubmit() {
    const toValidate: ExamConfigFormValues = {
      name: form.name,
      negativeMarkPerWrong: Number(form.negativeMarkPerWrong || 0) as unknown as number,
      daily: {
        enabled: form.daily.enabled,
        mcqCount: Number(form.daily.mcqCount || 0),
        mcqMarksEach: Number(form.daily.mcqMarksEach || 0),
        writtenCount: Number(form.daily.writtenCount || 0),
        writtenMarksEach: Number(form.daily.writtenMarksEach || 0)
      },
      weekly: {
        enabled: form.weekly.enabled,
        mcqCount: Number(form.weekly.mcqCount || 0),
        mcqMarksEach: Number(form.weekly.mcqMarksEach || 0),
        writtenCount: Number(form.weekly.writtenCount || 0),
        writtenMarksEach: Number(form.weekly.writtenMarksEach || 0)
      },
      monthly: {
        enabled: form.monthly.enabled,
        mcqCount: Number(form.monthly.mcqCount || 0),
        mcqMarksEach: Number(form.monthly.mcqMarksEach || 0),
        writtenCount: Number(form.monthly.writtenCount || 0),
        writtenMarksEach: Number(form.monthly.writtenMarksEach || 0)
      }
    };

    const result = examConfigFormSchema.safeParse(toValidate);
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
    const types = (['daily', 'weekly', 'monthly'] as ExamType[])
      .filter((t) => v[t].enabled)
      .map((t) => ({
        type: t,
        mcqCount: v[t].mcqCount,
        mcqMarksEach: v[t].mcqMarksEach,
        writtenCount: v[t].writtenCount,
        writtenMarksEach: v[t].writtenMarksEach
      }));

    try {
      if (isEdit && config) {
        await updateConfig(config.id, { name: v.name.trim(), negativeMarkPerWrong: v.negativeMarkPerWrong, types });
        pushToast('Config updated');
      } else {
        await addConfig({ name: v.name.trim(), negativeMarkPerWrong: v.negativeMarkPerWrong, types });
        pushToast('Config added');
      }
      onClose();
    } catch {
      pushToast('Something went wrong saving this config. Please try again.', undefined, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit exam config' : 'New exam config'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {isEdit ? 'Save changes' : 'Add config'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-muted">
          A config is a reusable scoring template for a course — set the MCQ and written breakdown once per exam
          type, then just pick it when you add an exam.
        </p>

        <Input
          label="Config name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          error={errors.name}
          placeholder={"e.g. উদ্ভাসে ভার্সিটি 'ক' কোর্স"}
        />

        <Input
          label="Negative mark per wrong MCQ"
          type="number"
          step="0.01"
          inputMode="decimal"
          value={form.negativeMarkPerWrong}
          onChange={(e) => setForm((f) => ({ ...f, negativeMarkPerWrong: e.target.value }))}
          error={errors.negativeMarkPerWrong}
        />

        {(['daily', 'weekly', 'monthly'] as ExamType[]).map((type) => {
          const row = form[type];
          const total =
            (Number(row.mcqCount || 0) * Number(row.mcqMarksEach || 0) +
              Number(row.writtenCount || 0) * Number(row.writtenMarksEach || 0)) || 0;
          return (
            <div key={type} className="space-y-3 rounded-control border border-border p-3">
              <label className="flex items-center gap-2 text-sm font-medium text-ink">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(e) => setTypeField(type, 'enabled', e.target.checked)}
                  className="h-4 w-4 rounded accent-accent"
                />
                {TYPE_LABELS[type]}
                {row.enabled && <span className="ml-auto text-xs font-normal text-ink-muted">Total: {total}</span>}
              </label>

              {row.enabled && (
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="MCQ questions"
                    type="number"
                    inputMode="numeric"
                    value={row.mcqCount}
                    onChange={(e) => setTypeField(type, 'mcqCount', e.target.value)}
                    error={errors[`${type}.mcqCount`]}
                  />
                  <Input
                    label="Marks per MCQ"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={row.mcqMarksEach}
                    onChange={(e) => setTypeField(type, 'mcqMarksEach', e.target.value)}
                    error={errors[`${type}.mcqMarksEach`]}
                  />
                  <Input
                    label="Written questions"
                    type="number"
                    inputMode="numeric"
                    value={row.writtenCount}
                    onChange={(e) => setTypeField(type, 'writtenCount', e.target.value)}
                    error={errors[`${type}.writtenCount`]}
                  />
                  <Input
                    label="Marks per written Q"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    value={row.writtenMarksEach}
                    onChange={(e) => setTypeField(type, 'writtenMarksEach', e.target.value)}
                    error={errors[`${type}.writtenMarksEach`]}
                  />
                </div>
              )}
            </div>
          );
        })}
        {errors['daily.enabled'] && <p className="text-sm text-danger">{errors['daily.enabled']}</p>}
      </div>
    </Sheet>
  );
}
