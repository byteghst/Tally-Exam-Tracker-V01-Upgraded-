import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import { Sheet } from '@/components/ui/Sheet';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { examConfigFormSchema, type ExamConfigFormValues } from '@/lib/validation/examConfigSchema';
import { useExamConfigStore } from '@/store/examConfigStore';
import { useUIStore } from '@/store/uiStore';
import { EASE_OUT } from '@/lib/motion';
import type { ExamConfig, ExamType } from '@/types';

interface ExamConfigFormProps {
  open: boolean;
  onClose: () => void;
  config?: ExamConfig;
}

type FieldErrors = Record<string, string | undefined>;

const TYPE_LABELS: Record<ExamType, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
const TYPE_DOT: Record<ExamType, string> = { daily: 'bg-accent', weekly: 'bg-saffron', monthly: 'bg-forest' };

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
      <div className="space-y-6">
        <p className="font-serif text-lg italic leading-snug text-ink-muted">
          A reusable scoring template for a course. Set the MCQ and written breakdown once per exam type, then just
          pick it when you add an exam.
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

        <div className="space-y-3">
          {(['daily', 'weekly', 'monthly'] as ExamType[]).map((type) => {
            const row = form[type];
            const total =
              (Number(row.mcqCount || 0) * Number(row.mcqMarksEach || 0) +
                Number(row.writtenCount || 0) * Number(row.writtenMarksEach || 0)) || 0;
            return (
              <div key={type} className="rounded-card bg-ink/[0.04] px-4">
                <div className="flex items-center gap-3 py-3">
                  <span className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', TYPE_DOT[type])} />
                  <p className="flex-1 text-base font-medium text-ink">{TYPE_LABELS[type]}</p>
                  {row.enabled && (
                    <span className="font-numeric text-sm tabular-nums text-ink-muted">Total {total}</span>
                  )}
                  <Switch
                    checked={row.enabled}
                    onChange={(checked) => setTypeField(type, 'enabled', checked)}
                    label={`Use ${TYPE_LABELS[type]} exams in this config`}
                  />
                </div>

                <AnimatePresence initial={false}>
                  {row.enabled && (
                    <motion.div
                      key={`${type}-fields`}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.4, ease: EASE_OUT }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-2 gap-x-5 gap-y-5 pb-5 pt-1">
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
        {errors['daily.enabled'] && <p className="text-sm text-danger">{errors['daily.enabled']}</p>}
      </div>
    </Sheet>
  );
}
