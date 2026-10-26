import { useMemo, useState } from 'react';
import { clsx } from 'clsx';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useStudyStore, type StudySession, type StudyTag } from '@/store/studyStore';
import { useUIStore } from '@/store/uiStore';
import { SUBJECT_COLORS, toneColor } from '@/lib/palette';

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function localDateISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function clockOf(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function durationLabel(ms: number): string {
  const mins = Math.round(ms / MINUTE_MS);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** From/to on one date. If "to" is earlier than "from", the session ran past midnight. */
function computeRange(date: string, from: string, to: string) {
  if (!date || !from || !to) return null;
  const start = new Date(`${date}T${from}`).getTime();
  let end = new Date(`${date}T${to}`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  const nextDay = end < start;
  if (nextDay) end += DAY_MS;
  return { start, end, durationMs: end - start, nextDay };
}

/** Small read-only pill that shows a session's tag. */
export function TagChip({ tag, className }: { tag: StudyTag; className?: string }) {
  const color = toneColor(tag.color);
  return (
    <span
      className={clsx(
        'inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-ink',
        className
      )}
      style={{ backgroundColor: `${color}26` }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="truncate">{tag.name}</span>
    </span>
  );
}

interface TagPickerProps {
  tags: StudyTag[];
  value: string | undefined;
  onChange: (id: string | undefined) => void;
  label?: string;
  /** Text of the first option, which clears the choice. */
  noneLabel?: string;
}

/** Pick one tag, or none. */
export function TagPicker({ tags, value, onChange, label, noneLabel = 'None' }: TagPickerProps) {
  return (
    <div className="flex flex-col gap-2" role="group" aria-label={label ?? 'Tag'}>
      {label && <p className="eyebrow">{label}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={value === undefined}
          onClick={() => onChange(undefined)}
          className={clsx(
            'rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors duration-200',
            value === undefined ? 'bg-ink text-surface' : 'bg-ink/[0.06] text-ink-muted hover:text-ink'
          )}
        >
          {noneLabel}
        </button>
        {tags.map((tag) => {
          const active = value === tag.id;
          const color = toneColor(tag.color);
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(active ? undefined : tag.id)}
              className={clsx(
                'flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors duration-200',
                active ? 'text-[#FBF8F2]' : 'bg-ink/[0.06] text-ink-muted hover:text-ink'
              )}
              style={active ? { backgroundColor: color } : undefined}
            >
              {!active && <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />}
              {tag.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Add a study session by hand (subject, date, from, to, optional tag), or edit
 * a saved one when `session` is given.
 */
export function LogSessionSheet({ onClose, session }: { onClose: () => void; session?: StudySession }) {
  const subjects = useStudyStore((s) => s.subjects);
  const tags = useStudyStore((s) => s.tags);
  const addSession = useStudyStore((s) => s.addSession);
  const updateSession = useStudyStore((s) => s.updateSession);
  const { pushToast } = useUIStore();
  const isEdit = !!session;

  const [subjectId, setSubjectId] = useState(session?.subjectId ?? subjects[0]?.id ?? '');
  const [date, setDate] = useState(() => localDateISO(session ? new Date(session.start) : new Date()));
  const [from, setFrom] = useState(session ? clockOf(session.start) : '');
  const [to, setTo] = useState(session ? clockOf(session.end) : '');
  const [tagId, setTagId] = useState<string | undefined>(session?.tagId);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => computeRange(date, from, to), [date, from, to]);

  // The times shown are only minute-accurate, and a timer session's length can be shorter than
  // end minus start (pauses). If the times were left alone, keep the saved start, end and length exactly.
  const timesUnchanged =
    !!session &&
    !!range &&
    Math.floor(range.start / MINUTE_MS) === Math.floor(session.start / MINUTE_MS) &&
    Math.floor(range.end / MINUTE_MS) === Math.floor(session.end / MINUTE_MS);

  function change<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setError(null);
    };
  }

  function handleSave() {
    if (!subjectId) {
      setError('Pick a subject.');
      return;
    }
    if (!range) {
      setError('Pick the date and both times.');
      return;
    }
    if (session && timesUnchanged) {
      updateSession(session.id, { subjectId, tagId });
      pushToast('Session updated');
      onClose();
      return;
    }
    if (range.durationMs <= 0) {
      setError('The start and end times are the same.');
      return;
    }
    if (range.end > Date.now() + 60_000) {
      setError('That session ends in the future.');
      return;
    }
    if (session) {
      updateSession(session.id, {
        subjectId,
        tagId,
        start: range.start,
        end: range.end,
        durationMs: range.durationMs
      });
      pushToast('Session updated');
    } else {
      addSession({ subjectId, start: range.start, end: range.end, tagId });
      pushToast('Session logged');
    }
    onClose();
  }

  const shownDuration = session && timesUnchanged ? session.durationMs : (range?.durationMs ?? 0);

  return (
    <Sheet
      open
      onClose={onClose}
      title={isEdit ? 'Edit session' : 'Log a session'}
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="flex-1" onClick={handleSave}>
            {isEdit ? 'Save changes' : 'Log session'}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <Select label="Subject" value={subjectId} onChange={(e) => change(setSubjectId)(e.target.value)}>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>

        <Input
          label="Date"
          type="date"
          max={localDateISO()}
          value={date}
          onChange={(e) => change(setDate)(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-5">
          <Input label="From" type="time" value={from} onChange={(e) => change(setFrom)(e.target.value)} />
          <Input label="To" type="time" value={to} onChange={(e) => change(setTo)(e.target.value)} />
        </div>

        {range && shownDuration > 0 && (
          <div className="rounded-card bg-accent-soft p-4">
            <p className="eyebrow !text-accent">Duration</p>
            <p className="mt-1 font-serif text-5xl leading-none tracking-tight text-ink">
              {durationLabel(shownDuration)}
            </p>
            {range.nextDay && <p className="mt-2 text-xs text-ink-muted">Ends the next day.</p>}
          </div>
        )}

        {tags.length > 0 && <TagPicker label="Tag" tags={tags} value={tagId} onChange={setTagId} />}

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Sheet>
  );
}

/** Create a new tag: a name and a colour. */
export function TagEditor({ onClose }: { onClose: () => void }) {
  const tags = useStudyStore((s) => s.tags);
  const addTag = useStudyStore((s) => s.addTag);
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(SUBJECT_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the tag a name.');
      return;
    }
    if (tags.some((t) => t.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('You already have a tag with that name.');
      return;
    }
    addTag(trimmed, color);
    onClose();
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="New tag"
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" className="flex-1" onClick={handleSave}>
            Add tag
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <TagChip tag={{ id: 'preview', name: name.trim() || 'Tag', color, createdAt: 0 }} />
        </div>

        <Input
          label="Tag name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder="e.g. Revision"
          maxLength={24}
        />

        <div>
          <span className="mb-2 block text-sm font-medium text-ink-muted">Colour</span>
          <div className="flex flex-wrap gap-3">
            {SUBJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-label={`Colour ${c}`}
                className={clsx(
                  'h-9 w-9 rounded-full transition-transform duration-200',
                  color === c ? 'scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface-raised' : ''
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-danger">{error}</p>}
      </div>
    </Sheet>
  );
}
