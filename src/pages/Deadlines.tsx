import { useState } from 'react';
import { Download, Pencil, Plus, Trash2 } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Rise, Section, Stagger } from '@/components/motion/Reveal';
import { CheckButton, StrikeText } from '@/components/motion/Check';
import { DeadlineForm } from '@/components/features/deadlines/DeadlineForm';
import { DeadlineCardSheet } from '@/components/features/deadlines/DeadlineCardSheet';
import { useDeadlineStore, type Deadline } from '@/store/deadlineStore';
import { describeCountdown, formatDate, todayISO } from '@/lib/dates';
import { formatTime12 } from '@/lib/deadlineFormat';

// Priority shows as a small coloured dot, the same as on Tasks.
const PRIORITY_DOT: Record<string, string> = {
  high: 'bg-danger',
  medium: 'bg-saffron',
  low: 'bg-forest'
};

function byDue(a: Deadline, b: Deadline): number {
  return a.dueDate.localeCompare(b.dueDate) || (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99');
}

export function Deadlines() {
  const deadlines = useDeadlineStore((s) => s.deadlines);
  const loaded = useDeadlineStore((s) => s.loaded);
  const toggleDone = useDeadlineStore((s) => s.toggleDone);
  const deleteDeadline = useDeadlineStore((s) => s.deleteDeadline);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Deadline | undefined>(undefined);
  const [cardFor, setCardFor] = useState<Deadline | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Deadline | null>(null);

  const today = todayISO();
  const open = deadlines.filter((d) => d.status === 'open');
  const overdue = open.filter((d) => d.dueDate < today).sort(byDue);
  const upcoming = open.filter((d) => d.dueDate >= today).sort(byDue);
  const finished = deadlines
    .filter((d) => d.status === 'done')
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 10);
  const next = upcoming[0] ?? overdue[0];

  function openAdd() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function openEdit(deadline: Deadline) {
    setEditing(deadline);
    setFormOpen(true);
  }

  function renderRows(list: Deadline[]) {
    return (
      <ul className="divide-y divide-border">
        {list.map((d) => (
          <DeadlineRow
            key={d.id}
            deadline={d}
            onToggle={() => toggleDone(d.id)}
            onCard={() => setCardFor(d)}
            onEdit={() => openEdit(d)}
            onDelete={() => setDeleteTarget(d)}
          />
        ))}
      </ul>
    );
  }

  return (
    <Stagger className="space-y-10 py-8">
      <Rise as="header" className="flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Due dates</p>
          <h1 className="mt-3 font-serif text-6xl leading-[0.9] tracking-tight text-ink">Deadlines</h1>
        </div>
        <Button size="sm" onClick={openAdd}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </Rise>

      {next && (
        <Rise>
          <p className="eyebrow">{next.dueDate < today ? 'Most overdue' : 'Next deadline'}</p>
          <p
            className={clsx(
              'mt-2 font-serif text-5xl leading-none tracking-tight',
              next.dueDate < today ? 'text-danger' : 'text-ink'
            )}
          >
            {describeCountdown(next.dueDate)}
          </p>
          <p className="mt-2 truncate text-ink-muted">{next.title}</p>
        </Rise>
      )}

      {overdue.length > 0 && <Section label="Overdue">{renderRows(overdue)}</Section>}

      <Section
        label="Upcoming"
        aside={
          upcoming.length > 0 ? (
            <span className="font-numeric text-sm tabular-nums text-ink-muted">{upcoming.length} open</span>
          ) : undefined
        }
      >
        {upcoming.length === 0 ? (
          <div>
            <p className="font-serif text-4xl leading-none tracking-tight text-ink">
              {loaded ? 'Nothing due.' : 'Loading…'}
            </p>
            {loaded && (
              <>
                <p className="mt-3 max-w-xs text-sm text-ink-muted">
                  Add a deadline and you can download a card for it, ready to share.
                </p>
                <Button size="sm" variant="secondary" className="mt-4" onClick={openAdd}>
                  Add a deadline
                </Button>
              </>
            )}
          </div>
        ) : (
          renderRows(upcoming)
        )}
      </Section>

      {finished.length > 0 && <Section label="Done">{renderRows(finished)}</Section>}

      {formOpen && (
        <DeadlineForm key={editing?.id ?? 'new'} deadline={editing} onClose={() => setFormOpen(false)} />
      )}
      {cardFor && <DeadlineCardSheet key={cardFor.id} deadline={cardFor} onClose={() => setCardFor(null)} />}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) void deleteDeadline(deleteTarget.id);
          setDeleteTarget(null);
        }}
        title={`Delete ${deleteTarget?.title ?? 'deadline'}?`}
        description="It is removed from your account for good and can't be brought back."
        confirmLabel="Delete"
      />
    </Stagger>
  );
}

function DeadlineRow({
  deadline,
  onToggle,
  onCard,
  onEdit,
  onDelete
}: {
  deadline: Deadline;
  onToggle: () => void;
  onCard: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const done = deadline.status === 'done';
  const isOverdue = !done && deadline.dueDate < todayISO();
  const dot = PRIORITY_DOT[deadline.priority] ?? 'bg-ink-faint';
  const when = [formatDate(deadline.dueDate), formatTime12(deadline.dueTime)].filter(Boolean).join(' · ');

  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <CheckButton
          checked={done}
          onToggle={onToggle}
          label={`Mark "${deadline.title}" ${done ? 'not done' : 'done'}`}
        />
        <span className={clsx('h-2 w-2 shrink-0 rounded-full', dot)} aria-hidden />
        <div className="min-w-0 flex-1">
          <StrikeText done={done} className="block truncate text-base">
            {deadline.title}
          </StrikeText>
          <p className={clsx('mt-0.5 truncate text-xs', isOverdue ? 'text-danger' : 'text-ink-muted')}>
            {done ? 'Done' : describeCountdown(deadline.dueDate)} · {when}
          </p>
        </div>
        <button
          onClick={onCard}
          aria-label={`Download card for ${deadline.title}`}
          className="shrink-0 rounded-control p-1.5 text-accent hover:bg-accent/10"
        >
          <Download size={16} />
        </button>
        <button
          onClick={onEdit}
          aria-label={`Edit ${deadline.title}`}
          className="shrink-0 rounded-control p-1.5 text-ink-muted hover:bg-ink/5 hover:text-ink"
        >
          <Pencil size={16} />
        </button>
        <button
          onClick={onDelete}
          aria-label={`Delete ${deadline.title}`}
          className="shrink-0 rounded-control p-1.5 text-ink-muted hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </li>
  );
}
