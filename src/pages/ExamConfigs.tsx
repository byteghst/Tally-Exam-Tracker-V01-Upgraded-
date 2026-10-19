import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { GlassCard } from '@/components/ui/GlassCard';
import { Rise, Stagger } from '@/components/motion/Reveal';
import { ExamConfigForm } from '@/components/features/examConfigs/ExamConfigForm';
import { useExamConfigStore } from '@/store/examConfigStore';
import type { ExamConfig } from '@/types';

const TYPE_LABELS: Record<string, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };
const TYPE_DOT: Record<string, string> = { daily: 'bg-accent', weekly: 'bg-saffron', monthly: 'bg-forest' };

export function ExamConfigs() {
  const { configs, deleteConfig } = useExamConfigStore();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExamConfig | undefined>(undefined);
  const [toDelete, setToDelete] = useState<ExamConfig | undefined>(undefined);

  return (
    <Stagger className="space-y-8 py-8">
      <Rise as="header" className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Templates</p>
          <h1 className="mt-3 font-serif text-6xl leading-[0.9] tracking-tight text-ink">Configs</h1>
          <p className="mt-3 max-w-xs text-sm text-ink-muted">Reusable scoring templates for your courses.</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditing(undefined);
            setFormOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> New
        </Button>
      </Rise>

      {configs.length === 0 && (
        <Rise>
          <GlassCard className="p-5">
            <p className="font-serif text-5xl leading-none tracking-tight text-ink">No configs yet.</p>
            <p className="mt-3 max-w-sm text-ink-muted">
              Add one to auto-fill the MCQ and written structure whenever you add an exam.
            </p>
          </GlassCard>
        </Rise>
      )}

      {configs.map((config) => (
        <Rise key={config.id}>
          <GlassCard className="p-5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-serif text-3xl italic leading-tight text-ink">{config.name}</p>
                <p className="mt-1 text-xs text-ink-muted">
                  Negative marking: {config.negativeMarkPerWrong} per wrong MCQ
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  aria-label="Edit config"
                  onClick={() => {
                    setEditing(config);
                    setFormOpen(true);
                  }}
                  className="rounded-full bg-ink/[0.06] p-2 text-ink-muted transition-colors hover:bg-ink/10 hover:text-ink"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Delete config"
                  onClick={() => setToDelete(config)}
                  className="rounded-full bg-ink/[0.06] p-2 text-ink-muted transition-colors hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <ul className="mt-4 space-y-2">
              {config.types.map((t) => {
                const total = t.mcqCount * t.mcqMarksEach + t.writtenCount * t.writtenMarksEach;
                return (
                  <li key={t.type} className="flex items-center gap-3 rounded-control bg-ink/[0.04] px-4 py-3">
                    <span className={clsx('h-2.5 w-2.5 shrink-0 rounded-full', TYPE_DOT[t.type])} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{TYPE_LABELS[t.type]}</p>
                      <p className="font-numeric text-xs tabular-nums text-ink-muted">
                        MCQ {t.mcqCount}×{t.mcqMarksEach} = {t.mcqCount * t.mcqMarksEach} · Written {t.writtenCount}×
                        {t.writtenMarksEach} = {t.writtenCount * t.writtenMarksEach}
                      </p>
                    </div>
                    <p className="font-serif text-3xl leading-none tracking-tight text-ink">{total}</p>
                  </li>
                );
              })}
            </ul>
          </GlassCard>
        </Rise>
      ))}

      <ExamConfigForm
        open={formOpen}
        config={editing}
        onClose={() => {
          setFormOpen(false);
          setEditing(undefined);
        }}
      />

      <ConfirmDialog
        open={!!toDelete}
        title="Delete config?"
        description={`"${toDelete?.name}" will be removed. Exams already recorded with it keep their own saved numbers.`}
        confirmLabel="Delete"
        onClose={() => setToDelete(undefined)}
        onConfirm={() => {
          if (toDelete) deleteConfig(toDelete.id);
        }}
      />
    </Stagger>
  );
}
