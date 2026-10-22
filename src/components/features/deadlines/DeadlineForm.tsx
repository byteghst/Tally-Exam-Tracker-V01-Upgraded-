import { useState } from 'react';
import { Sheet } from '@/components/ui/Sheet';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Segmented } from '@/components/ui/Segmented';
import { Button } from '@/components/ui/Button';
import { useDeadlineStore, type Deadline, type DeadlinePriority } from '@/store/deadlineStore';
import { useUIStore } from '@/store/uiStore';
import { todayISO } from '@/lib/dates';

interface DeadlineFormProps {
  /** Pass a deadline to edit it; leave out to add a new one. */
  deadline?: Deadline;
  onClose: () => void;
}

// Priority colours match the dots on the Tasks screen.
const PRIORITY_OPTIONS = [
  { value: 'low' as DeadlinePriority, label: 'Low', color: 'bg-forest' },
  { value: 'medium' as DeadlinePriority, label: 'Medium', color: 'bg-saffron' },
  { value: 'high' as DeadlinePriority, label: 'High', color: 'bg-danger' }
];

type FieldErrors = Record<string, string | undefined>;

export function DeadlineForm({ deadline, onClose }: DeadlineFormProps) {
  const addDeadline = useDeadlineStore((s) => s.addDeadline);
  const updateDeadline = useDeadlineStore((s) => s.updateDeadline);
  const pushToast = useUIStore((s) => s.pushToast);
  const isEdit = !!deadline;

  const [title, setTitle] = useState(deadline?.title ?? '');
  const [dueDate, setDueDate] = useState(deadline?.dueDate ?? todayISO());
  const [dueTime, setDueTime] = useState(deadline?.dueTime ?? '');
  const [priority, setPriority] = useState<DeadlinePriority>(deadline?.priority ?? 'medium');
  const [category, setCategory] = useState(deadline?.category ?? '');
  const [notes, setNotes] = useState(deadline?.notes ?? '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    const next: FieldErrors = {};
    const cleanTitle = title.trim();
    if (!cleanTitle) next.title = 'Give the deadline a title.';
    if (!dueDate) next.dueDate = 'Pick a due date.';
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setErrors({});
    setSubmitting(true);

    const payload = {
      title: cleanTitle,
      dueDate,
      dueTime: dueTime || undefined,
      priority,
      category: category.trim() || undefined,
      notes: notes.trim() || undefined,
      status: deadline?.status ?? ('open' as const)
    };

    const ok = deadline ? await updateDeadline(deadline.id, payload) : (await addDeadline(payload)) !== null;
    setSubmitting(false);
    if (ok) {
      pushToast(isEdit ? 'Deadline updated' : 'Deadline added');
      onClose();
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={isEdit ? 'Edit deadline' : 'Add deadline'}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={submitting}>
            {isEdit ? 'Save changes' : 'Add deadline'}
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <Input
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
          placeholder="e.g. Submit the chemistry assignment"
          maxLength={120}
        />

        <div className="grid grid-cols-2 gap-5">
          <Input
            label="Due date"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            error={errors.dueDate}
          />
          <Input label="Time (optional)" type="time" value={dueTime} onChange={(e) => setDueTime(e.target.value)} />
        </div>

        <Segmented label="Priority" options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} />

        <Input
          label="Category (optional)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. Physics, Admission, Fees"
          maxLength={40}
        />

        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
      </div>
    </Sheet>
  );
}
