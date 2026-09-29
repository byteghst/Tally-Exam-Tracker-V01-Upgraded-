import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, Square, Plus, Pencil, Trash2, ImagePlus, X, Timer } from 'lucide-react';
import { clsx } from 'clsx';
import { GlassCard } from '@/components/ui/GlassCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useStudyStore, elapsedMs, type StudySubject } from '@/store/studyStore';
import { fileToResizedDataUrl } from '@/lib/imageResize';

const COLORS = ['#284EFE', '#7C3AED', '#0EA5A4', '#E0A93E', '#E0645E', '#3EBD7E', '#EC4899', '#64748B'];
const DAY_MS = 86_400_000;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatShort(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return ms > 0 ? '<1m' : '0m';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Re-renders while a timer exists, and immediately when the app returns to the foreground. */
function useNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 500);
    const onVisible = () => setNow(Date.now());
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled]);
  return now;
}

/**
 * Shows the subject's full picture (no cropping) letterboxed on a tinted
 * backdrop of the subject's own color, so portrait/landscape/square photos
 * of a book cover or notes page are all fully visible instead of being
 * cropped to fill the frame.
 */
function SubjectCover({ subject, className }: { subject: StudySubject; className?: string }) {
  return (
    <div
      className={clsx('relative overflow-hidden', className)}
      style={{ background: `linear-gradient(135deg, ${subject.color}33, ${subject.color}11)` }}
    >
      {subject.image ? (
        <img src={subject.image} alt="" className="h-full w-full object-contain" />
      ) : (
        <span
          className="grid h-full w-full place-items-center font-display text-3xl font-bold text-white/90"
          style={{ background: `linear-gradient(135deg, ${subject.color}, ${subject.color}AA)` }}
        >
          {subject.name.charAt(0).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function SubjectEditor({ subject, onClose }: { subject: StudySubject | null; onClose: () => void }) {
  const addSubject = useStudyStore((s) => s.addSubject);
  const updateSubject = useStudyStore((s) => s.updateSubject);
  const [name, setName] = useState(subject?.name ?? '');
  const [color, setColor] = useState(subject?.color ?? COLORS[0]);
  const [image, setImage] = useState<string | undefined>(subject?.image);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      setImage(await fileToResizedDataUrl(file));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load that image.');
    } finally {
      setBusy(false);
    }
  }

  function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the subject a name.');
      return;
    }
    if (subject) updateSubject(subject.id, { name: trimmed, color, image });
    else addSubject(trimmed, color, image);
    onClose();
  }

  const preview: StudySubject = {
    id: subject?.id ?? 'preview',
    name: name.trim() || 'Subject',
    color,
    image,
    createdAt: 0
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[90dvh] w-full overflow-y-auto rounded-t-card border border-border bg-surface-raised p-5 pb-safe-bottom md:max-w-md md:rounded-card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">{subject ? 'Edit subject' : 'New subject'}</h2>
          <button onClick={onClose} aria-label="Close">
            <X size={20} className="text-ink-muted" />
          </button>
        </div>

        <SubjectCover subject={preview} className="mb-4 h-36 w-full rounded-card" />

        <div className="mb-4 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
            <ImagePlus className="h-4 w-4" /> {busy ? 'Loading...' : image ? 'Change picture' : 'Add picture'}
          </Button>
          {image && (
            <Button type="button" variant="ghost" size="sm" onClick={() => setImage(undefined)}>
              Remove picture
            </Button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePick} />
        </div>

        <div className="space-y-4">
          <Input
            label="Subject name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Physics 1st Paper"
            maxLength={60}
          />

          <div>
            <span className="mb-1.5 block text-sm font-medium text-ink-muted">Color</span>
            <div className="flex flex-wrap gap-2.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={clsx(
                    'h-8 w-8 rounded-full transition-transform',
                    color === c ? 'scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface-raised' : ''
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" className="flex-1" onClick={handleSave} disabled={busy}>
              {subject ? 'Save' : 'Add subject'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Study() {
  const subjects = useStudyStore((s) => s.subjects);
  const sessions = useStudyStore((s) => s.sessions);
  const active = useStudyStore((s) => s.active);
  const start = useStudyStore((s) => s.start);
  const pause = useStudyStore((s) => s.pause);
  const resume = useStudyStore((s) => s.resume);
  const stop = useStudyStore((s) => s.stop);
  const discard = useStudyStore((s) => s.discard);
  const removeSubject = useStudyStore((s) => s.removeSubject);
  const removeSession = useStudyStore((s) => s.removeSession);

  const [editing, setEditing] = useState<StudySubject | 'new' | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StudySubject | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);

  const now = useNow(active !== null);
  const running = active !== null && active.startedAt !== null;
  const activeMs = active ? elapsedMs(active, now) : 0;
  const activeSubject = active ? subjects.find((s) => s.id === active.subjectId) : undefined;

  const totals = useMemo(() => {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const todayFrom = dayStart.getTime();
    const weekFrom = todayFrom - 6 * DAY_MS;
    const today: Record<string, number> = {};
    const week: Record<string, number> = {};
    const all: Record<string, number> = {};
    for (const s of sessions) {
      all[s.subjectId] = (all[s.subjectId] ?? 0) + s.durationMs;
      if (s.end >= weekFrom) week[s.subjectId] = (week[s.subjectId] ?? 0) + s.durationMs;
      if (s.end >= todayFrom) today[s.subjectId] = (today[s.subjectId] ?? 0) + s.durationMs;
    }
    return { today, week, all };
  }, [sessions]);

  function live(map: Record<string, number>, subjectId: string): number {
    return (map[subjectId] ?? 0) + (active?.subjectId === subjectId ? activeMs : 0);
  }

  const todayTotal = subjects.reduce((sum, s) => sum + live(totals.today, s.id), 0);
  const weekTotal = subjects.reduce((sum, s) => sum + live(totals.week, s.id), 0);

  const recent = useMemo(() => [...sessions].sort((a, b) => b.end - a.end).slice(0, 8), [sessions]);

  return (
    <div className="space-y-6 py-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold text-ink">Study</h1>
        <Button size="sm" onClick={() => setEditing('new')}>
          <Plus className="h-4 w-4" /> Subject
        </Button>
      </div>

      {active && activeSubject ? (
        <GlassCard accented className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <SubjectCover subject={activeSubject} className="h-12 w-12 shrink-0 rounded-control" />
            <div className="min-w-0">
              <p className="truncate font-display text-lg font-semibold text-ink">{activeSubject.name}</p>
              <p className="text-sm text-ink-muted">{running ? 'Studying now' : 'Paused'}</p>
            </div>
          </div>
          <p className="tabular-nums text-center text-5xl font-bold tracking-tight text-ink">{formatClock(activeMs)}</p>
          <div className="flex gap-2">
            {running ? (
              <Button variant="secondary" className="flex-1" onClick={pause}>
                <Pause className="h-4 w-4" /> Pause
              </Button>
            ) : (
              <Button className="flex-1" onClick={resume}>
                <Play className="h-4 w-4" /> Resume
              </Button>
            )}
            <Button className="flex-1" onClick={stop}>
              <Square className="h-4 w-4" /> Stop &amp; save
            </Button>
          </div>
          <button
            onClick={() => setDiscardOpen(true)}
            className="w-full text-center text-sm text-ink-faint underline-offset-2 hover:text-danger hover:underline"
          >
            Discard this session
          </button>
          <p className="text-center text-xs text-ink-faint">
            The timer keeps running if you switch apps or close Tally.
          </p>
        </GlassCard>
      ) : (
        <GlassCard className="flex items-center gap-3 p-5">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-accent/[0.12] text-accent">
            <Timer size={22} />
          </div>
          <div>
            <p className="font-medium text-ink">Ready when you are</p>
            <p className="text-sm text-ink-muted">Tap a subject below to start the timer.</p>
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-2 gap-3">
        <GlassCard className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Today</p>
          <p className="tabular-nums mt-1 text-2xl font-bold text-ink">{formatShort(todayTotal)}</p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">Last 7 days</p>
          <p className="tabular-nums mt-1 text-2xl font-bold text-ink">{formatShort(weekTotal)}</p>
        </GlassCard>
      </div>

      <section className="space-y-3">
        <h2 className="font-display text-lg font-semibold text-ink">Subjects</h2>
        {subjects.length === 0 ? (
          <GlassCard className="space-y-3 p-6 text-center">
            <p className="text-sm text-ink-muted">
              Add the subjects you study, with a picture if you like, then track time on each one.
            </p>
            <Button onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" /> Add your first subject
            </Button>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {subjects.map((subject) => {
              const isActive = active?.subjectId === subject.id;
              return (
                <GlassCard
                  key={subject.id}
                  interactive
                  accented={isActive}
                  className="overflow-hidden"
                  onClick={() => (isActive && running ? pause() : start(subject.id))}
                >
                  <div className="relative">
                    <SubjectCover subject={subject} className="h-28 w-full" />
                    {isActive && (
                      <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white">
                        {running ? 'Studying' : 'Paused'}
                      </span>
                    )}
                    <span className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/55 text-white">
                      {isActive && running ? <Pause size={15} /> : <Play size={15} />}
                    </span>
                  </div>
                  <div className="space-y-1 p-3">
                    <p className="truncate font-display text-sm font-semibold text-ink">{subject.name}</p>
                    <p className="tabular-nums text-xs text-ink-muted">
                      Today {formatShort(live(totals.today, subject.id))} · Total {formatShort(live(totals.all, subject.id))}
                    </p>
                    <div className="flex justify-end gap-1 pt-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(subject);
                        }}
                        aria-label={`Edit ${subject.name}`}
                        className="rounded-control p-1.5 text-ink-muted hover:bg-white/5 hover:text-ink"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget(subject);
                        }}
                        aria-label={`Delete ${subject.name}`}
                        className="rounded-control p-1.5 text-ink-muted hover:bg-white/5 hover:text-danger"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </section>

      {recent.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-ink">Recent sessions</h2>
          <GlassCard className="divide-y divide-border p-1">
            {recent.map((session) => {
              const subject = subjects.find((s) => s.id === session.subjectId);
              return (
                <div key={session.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: subject?.color ?? '#64748B' }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{subject?.name ?? 'Deleted subject'}</p>
                    <p className="text-xs text-ink-muted">
                      {new Date(session.end).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })},{' '}
                      {new Date(session.start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} to{' '}
                      {new Date(session.end).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                  <span className="tabular-nums text-sm font-semibold text-ink">{formatShort(session.durationMs)}</span>
                  <button
                    onClick={() => removeSession(session.id)}
                    aria-label="Delete session"
                    className="rounded-control p-1.5 text-ink-faint hover:bg-white/5 hover:text-danger"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </GlassCard>
        </section>
      )}

      {editing !== null && (
        <SubjectEditor subject={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) removeSubject(deleteTarget.id);
          setDeleteTarget(null);
        }}
        title={`Delete ${deleteTarget?.name ?? 'subject'}?`}
        description="This also removes all study time logged for this subject."
        confirmLabel="Delete"
      />

      <ConfirmDialog
        open={discardOpen}
        onClose={() => setDiscardOpen(false)}
        onConfirm={() => {
          discard();
          setDiscardOpen(false);
        }}
        title="Discard this session?"
        description="The time on the timer will not be saved."
        confirmLabel="Discard"
      />
    </div>
  );
}
