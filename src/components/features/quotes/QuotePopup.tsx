import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { PopupFrame } from '@/components/ui/Popup';
import { Button } from '@/components/ui/Button';
import { useQuoteStore } from '@/store/quoteStore';
import { useUIStore } from '@/store/uiStore';
import { saveImage } from '@/lib/quotes/save';

/**
 * The daily quote popup, mounted once in the app shell. With a live photo card it shows
 * the card and a Download button; once the card is gone (24 hours after sending) it shows
 * just the quote and its author. There is no list of earlier days.
 */
export function QuotePopup() {
  const { open, loading, quote, error, close, openLatest } = useQuoteStore();
  const pushToast = useUIStore((s) => s.pushToast);
  const [imageState, setImageState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [saving, setSaving] = useState(false);

  const cardUrl = quote?.cardUrl ?? null;
  useEffect(() => {
    setImageState('loading');
  }, [cardUrl]);

  const showCard = !!cardUrl && imageState !== 'failed';

  async function handleDownload() {
    if (!cardUrl || !quote) return;
    setSaving(true);
    try {
      const day = quote.sentAt.slice(0, 10);
      const where = await saveImage(cardUrl, `tally-quote-${day}.jpg`);
      pushToast(where === 'device' ? 'Saved to Documents on your device' : 'Image downloaded');
    } catch {
      pushToast("Couldn't save the image. Please try again.", undefined, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <PopupFrame open={open} onClose={close} labelledBy="quote-popup-title">
      <div className="px-5 pb-5 pt-5">
        <div className="flex items-center justify-between">
          <p id="quote-popup-title" className="eyebrow">
            Quote of the day
          </p>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full text-ink-muted transition-colors hover:bg-ink/5"
          >
            <X size={18} />
          </button>
        </div>

        {loading && <p className="py-14 text-center text-sm text-ink-muted">Loading…</p>}

        {!loading && error && (
          <div className="py-10 text-center">
            <p className="text-sm text-ink-muted">
              {error === 'offline'
                ? "You're offline. Connect to the internet to see the quote."
                : "Couldn't load the quote."}
            </p>
            <Button size="sm" variant="secondary" className="mt-4" onClick={() => void openLatest()}>
              Try again
            </Button>
          </div>
        )}

        {!loading && !error && !quote && (
          <p className="py-14 text-center text-sm text-ink-muted">No quote yet. Check back soon.</p>
        )}

        {!loading && !error && quote && (
          <div className="mt-4">
            {showCard ? (
              <>
                <div
                  className="overflow-hidden rounded-[22px] bg-ink/[0.05]"
                  style={imageState === 'loading' ? { aspectRatio: '4 / 5' } : undefined}
                >
                  <img
                    src={cardUrl ?? undefined}
                    alt={`${quote.quote} — ${quote.author}`}
                    className="block w-full"
                    onLoad={() => setImageState('ready')}
                    onError={() => setImageState('failed')}
                  />
                </div>
                <Button
                  size="lg"
                  className="mt-4 w-full"
                  onClick={handleDownload}
                  loading={saving}
                  disabled={imageState !== 'ready'}
                >
                  {!saving && <Download size={18} />}
                  Download card
                </Button>
              </>
            ) : (
              <div className="px-1 pb-2 pt-2">
                <p className="font-serif text-[1.75rem] leading-snug tracking-tight text-ink">
                  &ldquo;{quote.quote}&rdquo;
                </p>
                <p className="eyebrow mt-5">&mdash; {quote.author}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </PopupFrame>
  );
}
