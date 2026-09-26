import { useState } from 'react';
import { Plus, Pencil, Trash2, SlidersHorizontal } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ExamConfigForm } from '@/components/features/examConfigs/ExamConfigForm';
import { useExamConfigStore } from '@/store/examConfigStore';
import type { ExamConfig } from '@/types';

const TYPE_LABELS: Record<string, string> = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' };

export function ExamConfigs() {
  const { configs, deleteConfig } = useExamConfigStore();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExamConfig | undefined>(undefined);
  const [toDelete, setToDelete] = useState<ExamConfig | undefined>(undefined);

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-ink">Exam configs</h1>
          <p className="text-sm text-ink-muted">Reusable scoring templates for your courses.</p>
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
      </div>

      {configs.length === 0 && (
        <GlassCard className="flex flex-col items-center gap-2 p-8 text-center">
          <SlidersHorizontal className="h-8 w-8 text-ink-faint" />
          <p className="text-sm text-ink-muted">
            No configs yet. Add one to auto-fill the MCQ/written structure whenever you add an exam.
          </p>
        </GlassCard>
      )}

      <div className="space-y-3">
        {configs.map((config) => (
          <GlassCard key={config.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium text-ink">{config.name}</p>
                <p className="text-xs text-ink-muted">Negative marking: {config.negativeMarkPerWrong} per wrong MCQ</p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  aria-label="Edit config"
                  onClick={() => {
                    setEditing(config);
                    setFormOpen(true);
                  }}
                  className="rounded-control p-2 text-ink-muted hover:bg-white/5 hover:text-ink"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Delete config"
                  onClick={() => setToDelete(config)}
                  className="rounded-control p-2 text-ink-muted hover:bg-danger/10 hover:text-danger"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {config.types.map((t) => {
                const total = t.mcqCount * t.mcqMarksEach + t.writtenCount * t.writtenMarksEach;
                return (
                  <div key={t.type} className="rounded-control bg-white/5 p-2.5 text-xs">
                    <p className="mb-1 font-semibold text-ink">{TYPE_LABELS[t.type]}</p>
                    <p className="text-ink-muted">
                      MCQ {t.mcqCount}×{t.mcqMarksEach} = {t.mcqCount * t.mcqMarksEach}
                    </p>
                    <p className="text-ink-muted">
                      Written {t.writtenCount}×{t.writtenMarksEach} = {t.writtenCount * t.writtenMarksEach}
                    </p>
                    <p className="mt-1 font-medium text-accent">Total {total}</p>
                  </div>
                );
              })}
            </div>
          </GlassCard>
        ))}
      </div>

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
    </div>
  );
}
