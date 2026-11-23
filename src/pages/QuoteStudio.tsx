import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, ImagePlus, RefreshCw, Send, Trash2, CalendarClock } from 'lucide-react';
import { clsx } from 'clsx';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageLoader } from '@/components/ui/PageLoader';
import { Rise, Section, Stagger } from '@/components/motion/Reveal';
import { useUIStore } from '@/store/uiStore';
import {
  checkIsAdmin,
  createQuote,
  deleteQuote,
  dispatchNow,
  isCardLive,
  listAdminQuotes,
  prepareCardImage,
  type AdminQuote,
  type QuoteStatus
} from '@/lib/quotes/api';

const STATUS_STYLE: Record<QuoteStatus, string> = {
  scheduled: 'bg-saffron/15 text-saffron',
  sending: 'bg-ink/10 text-ink-muted',
  sent: 'bg-forest/10 text-forest',
  failed: 'bg-danger/10 text-danger'
};

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** The next 9:30 AM on this phone's clock, in the format a datetime-local field wants. */
function defaultSchedule(): string {
  const d = new Date();
  d.setHours(9, 30, 0, 0);
  if (d.getTime() <= Date.now() + 60_000) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * Admin-only screen for the daily quote: write a quote, attach its photo card, then schedule it
 * or send it right now. Only the account listed in the `admins` table can open it; the database
 * rules enforce that as well, so hiding the link is not the only protection.
 */
export function QuoteStudio() {
  const navigate = useNavigate();
  const pushToast = useUIStore((s) => s.pushToast);
  const fileRef = useRef<HTMLInputElement>(null);

  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [rows, setRows] = useState<AdminQuote[]>([]);
  const [quote, setQuote] = useState('');
  const [author, setAuthor] = useState('');
  const [source, setSource] = useState('');
  const [when, setWhen] = useState(defaultSchedule);
  const [card, setCard] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState<'schedule' | 'now' | 'card' | null>(null);
  const [errors, setErrors] = useState<{ quote?: string; author?: string; source?: string; when?: string }>({});
  const [toDelete, setToDelete] = useState<AdminQuote | null>(null);

  const reload = useCallback(async () => {
    try {
      setRows(await listAdminQuotes());
    } catch {
      pushToast("Couldn't load the list.", undefined, 'error');
    }
  }, [pushToast]);

  useEffect(() => {
    let cancelled = false;
    void checkIsAdmin().then((ok) => {
      if (cancelled) return;
      setIsAdmin(ok);
      if (ok) void reload();
    });
    return () => {
      cancelled = true;
    };
  }, [reload]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  if (isAdmin === null) return <PageLoader label="Checking access" />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  async function handlePickCard(file: File | undefined) {
    if (!file) return;
    setBusy('card');
    try {
      const blob = await prepareCardImage(file);
      setCard(blob);
      setPreview(URL.createObjectURL(blob));
    } catch (e) {
      pushToast(e instanceof Error ? e.message : "Couldn't use that image.", undefined, 'error');
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function clearCard() {
    setCard(null);
    setPreview(null);
  }

  function validate(sendNow: boolean): Date | null {
    const next: typeof errors = {};
    if (!quote.trim()) next.quote = 'Write the quote.';
    else if (quote.trim().length > 600) next.quote = 'Keep it under 600 characters.';
    if (!author.trim()) next.author = 'Who said it?';
    if (!source.trim()) next.source = 'Add where it comes from (book, speech or interview).';
    let date = new Date();
    if (!sendNow) {
      date = new Date(when);
      if (Number.isNaN(date.getTime())) next.when = 'Pick a date and time.';
      else if (date.getTime() < Date.now() + 60_000) next.when = 'Pick a time in the future, or use Send now.';
    }
    setErrors(next);
    return Object.keys(next).length === 0 ? date : null;
  }

  function resetForm() {
    setQuote('');
    setAuthor('');
    setSource('');
    setWhen(defaultSchedule());
    clearCard();
    setErrors({});
  }

  async function handleSchedule() {
    const date = validate(false);
    if (!date) return;
    setBusy('schedule');
    try {
      await createQuote({ quote: quote.trim(), author: author.trim(), source: source.trim(), scheduledAt: date, card });
      pushToast(`Scheduled for ${formatWhen(date.toISOString())}`);
      resetForm();
      await reload();
    } catch {
      pushToast("Couldn't save the quote. Check your connection and try again.", undefined, 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleSendNow() {
    if (!validate(true)) return;
    setBusy('now');
    try {
      // A few seconds in the past so the server clock never sees it as "not due yet".
      await createQuote({
        quote: quote.trim(),
        author: author.trim(),
        source: source.trim(),
        scheduledAt: new Date(Date.now() - 5000),
        card
      });
      try {
        const r = await dispatchNow();
        pushToast(r.sent > 0 ? `Sent to ${r.sent} device${r.sent === 1 ? '' : 's'}` : 'Sent. No devices are registered yet.');
      } catch {
        pushToast('Saved. It will go out within a minute.');
      }
      resetForm();
      await reload();
    } catch {
      pushToast("Couldn't send the quote. Check your connection and try again.", undefined, 'error');
    } finally {
      setBusy(null);
    }
  }

  async function handleDelete(row: AdminQuote) {
    try {
      await deleteQuote(row);
      setRows((r) => r.filter((x) => x.id !== row.id));
      pushToast('Deleted');
    } catch {
      pushToast("Couldn't delete it.", undefined, 'error');
    }
  }

  return (
    <Stagger className="space-y-8 py-8">
      <Rise as="header">
        <button
          type="button"
          onClick={() => navigate('/settings')}
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={16} /> Settings
        </button>
        <p className="eyebrow">Admin</p>
        <h1 className="mt-3 font-serif text-6xl leading-[0.9] tracking-tight text-ink">Quote studio</h1>
      </Rise>

      <Section label="New quote" card>
        <div className="space-y-4">
          <Textarea
            label="Quote"
            rows={4}
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            error={errors.quote}
            placeholder="The exact words, as the person said or wrote them"
          />
          <Input label="Author" value={author} onChange={(e) => setAuthor(e.target.value)} error={errors.author} />
          <Input
            label="Source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            error={errors.source}
            placeholder="Book, speech or interview. Only you see this."
          />

          <div className="flex flex-col gap-1.5">
            <span className="eyebrow">Photo card (optional)</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void handlePickCard(e.target.files?.[0])}
            />
            {preview ? (
              <div className="flex items-start gap-3">
                <img src={preview} alt="Card preview" className="h-40 rounded-2xl object-cover" />
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-ink-muted">{card ? `${Math.round(card.size / 1024)} KB, ready` : ''}</p>
                  <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={busy !== null}>
                    Change
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clearCard} disabled={busy !== null}>
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="secondary"
                onClick={() => fileRef.current?.click()}
                loading={busy === 'card'}
                disabled={busy !== null}
                className="w-fit"
              >
                {busy !== 'card' && <ImagePlus size={16} />}
                Choose photo card
              </Button>
            )}
            <p className="text-xs text-ink-faint">
              Portrait 4:5 (for example 1080 &times; 1350) looks best. It is shrunk to under 900 KB and deleted from
              the server 24 hours after it is sent.
            </p>
          </div>

          <Input
            label="Send at (this phone's time)"
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            error={errors.when}
          />

          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={handleSchedule} loading={busy === 'schedule'} disabled={busy !== null}>
              {busy !== 'schedule' && <CalendarClock size={16} />}
              Schedule
            </Button>
            <Button variant="secondary" onClick={handleSendNow} loading={busy === 'now'} disabled={busy !== null}>
              {busy !== 'now' && <Send size={16} />}
              Send now
            </Button>
          </div>
        </div>
      </Section>

      <Section label="Scheduled and sent" card>
        <div className="mb-3 flex justify-end">
          <Button size="sm" variant="ghost" onClick={() => void reload()}>
            <RefreshCw size={14} /> Refresh
          </Button>
        </div>
        {rows.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing yet.</p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li key={row.id} className="rounded-2xl bg-ink/[0.04] p-4">
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={clsx(
                      'rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
                      STATUS_STYLE[row.status]
                    )}
                  >
                    {row.status}
                  </span>
                  <button
                    type="button"
                    aria-label="Delete"
                    onClick={() => setToDelete(row)}
                    className="grid h-8 w-8 place-items-center rounded-full text-ink-muted hover:bg-ink/5"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <p className="mt-2 line-clamp-3 font-serif text-lg leading-snug text-ink">&ldquo;{row.quote}&rdquo;</p>
                <p className="eyebrow mt-2">&mdash; {row.author}</p>
                <p className="mt-2 text-xs text-ink-muted">
                  {row.status === 'sent' && row.sentAt
                    ? `Sent ${formatWhen(row.sentAt)} to ${row.recipients ?? 0} device${row.recipients === 1 ? '' : 's'}`
                    : `${row.status === 'failed' ? 'Was due' : 'Goes out'} ${formatWhen(row.scheduledAt)}`}
                  {' · '}
                  {row.cardPath
                    ? row.status === 'sent' && !isCardLive(row.sentAt, row.cardPath)
                      ? 'card expired'
                      : 'with card'
                    : 'no card'}
                </p>
                <p className="mt-1 text-xs text-ink-faint">Source: {row.source}</p>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <ConfirmDialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => toDelete && void handleDelete(toDelete)}
        title="Delete this quote?"
        description="It is removed for good, along with its photo card. If it was already sent, the notification on phones stays but the popup will no longer show it."
        confirmLabel="Delete"
      />
    </Stagger>
  );
}
