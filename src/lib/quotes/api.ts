import { supabase } from '@/lib/supabase/client';

export const QUOTE_BUCKET = 'quote-cards';
/** A photo card is deleted from the server this long after its quote was sent. */
export const CARD_LIFETIME_MS = 24 * 60 * 60 * 1000;

const SEEN_KEY = 'tally-quote-seen';

/** What every signed-in person sees: the latest quote that went out. */
export interface LatestQuote {
  id: string;
  quote: string;
  author: string;
  sentAt: string;
  /** Present only while the card still exists (within 24 hours of sending). */
  cardUrl: string | null;
}

export type QuoteStatus = 'scheduled' | 'sending' | 'sent' | 'failed';

/** A row as the admin sees it, including the source and delivery numbers. */
export interface AdminQuote {
  id: string;
  quote: string;
  author: string;
  source: string;
  cardPath: string | null;
  scheduledAt: string;
  status: QuoteStatus;
  sentAt: string | null;
  recipients: number | null;
}

export function cardPublicUrl(path: string): string {
  return supabase.storage.from(QUOTE_BUCKET).getPublicUrl(path).data.publicUrl;
}

export function isCardLive(sentAt: string | null, cardPath: string | null): boolean {
  if (!sentAt || !cardPath) return false;
  return Date.now() - new Date(sentAt).getTime() < CARD_LIFETIME_MS;
}

export async function fetchLatestQuote(): Promise<LatestQuote | null> {
  const { data, error } = await supabase
    .from('daily_quotes')
    .select('id, quote, author, card_path, sent_at')
    .eq('status', 'sent')
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id as string,
    quote: data.quote as string,
    author: data.author as string,
    sentAt: data.sent_at as string,
    cardUrl: isCardLive(data.sent_at as string, data.card_path as string | null)
      ? cardPublicUrl(data.card_path as string)
      : null
  };
}

export function getSeenQuoteId(): string | null {
  try {
    return localStorage.getItem(SEEN_KEY);
  } catch {
    return null;
  }
}

export function markQuoteSeen(id: string): void {
  try {
    localStorage.setItem(SEEN_KEY, id);
  } catch {
    /* private mode: the popup may show once more, nothing else */
  }
}

// ---------------------------------------------------------------- admin

export async function checkIsAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_admin');
  if (error) return false;
  return data === true;
}

export async function listAdminQuotes(): Promise<AdminQuote[]> {
  const { data, error } = await supabase
    .from('daily_quotes')
    .select('id, quote, author, source, card_path, scheduled_at, status, sent_at, recipients')
    .order('scheduled_at', { ascending: false })
    .limit(40);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id as string,
    quote: r.quote as string,
    author: r.author as string,
    source: r.source as string,
    cardPath: (r.card_path as string | null) ?? null,
    scheduledAt: r.scheduled_at as string,
    status: r.status as QuoteStatus,
    sentAt: (r.sent_at as string | null) ?? null,
    recipients: (r.recipients as number | null) ?? null
  }));
}

export interface NewQuote {
  quote: string;
  author: string;
  source: string;
  scheduledAt: Date;
  card: Blob | null;
}

/** Uploads the card (if any), then saves the quote. The card is removed again if saving fails. */
export async function createQuote(input: NewQuote): Promise<void> {
  let cardPath: string | null = null;
  if (input.card) {
    cardPath = `${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await supabase.storage
      .from(QUOTE_BUCKET)
      .upload(cardPath, input.card, { contentType: 'image/jpeg', cacheControl: '3600' });
    if (uploadError) throw uploadError;
  }
  const { error } = await supabase.from('daily_quotes').insert({
    quote: input.quote,
    author: input.author,
    source: input.source,
    card_path: cardPath,
    scheduled_at: input.scheduledAt.toISOString()
  });
  if (error) {
    if (cardPath) await supabase.storage.from(QUOTE_BUCKET).remove([cardPath]);
    throw error;
  }
}

export async function deleteQuote(row: AdminQuote): Promise<void> {
  if (row.cardPath) {
    await supabase.storage.from(QUOTE_BUCKET).remove([row.cardPath]);
  }
  const { error } = await supabase.from('daily_quotes').delete().eq('id', row.id);
  if (error) throw error;
}

/** Asks the server to send whatever is due right now (used by "Send now"). */
export async function dispatchNow(): Promise<{ sent: number; devices: number }> {
  const { data, error } = await supabase.functions.invoke('dispatch-quotes', { body: {} });
  if (error) throw error;
  const sent = Array.isArray(data?.sent) ? (data.sent as { ok?: number; devices?: number }[]) : [];
  return {
    sent: sent.reduce((n, s) => n + (s.ok ?? 0), 0),
    devices: sent.reduce((n, s) => Math.max(n, s.devices ?? 0), 0)
  };
}

// ---------------------------------------------------------------- card image

const CARD_MAX_SIDE = 1350;
const CARD_MAX_BYTES = 900 * 1024; // keeps the picture small enough to show inside the notification itself

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('That file is not an image'));
    };
    img.src = url;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/** Scales a chosen picture down and re-encodes it as a JPEG under about 900 KB. */
export async function prepareCardImage(file: File): Promise<Blob> {
  const img = await loadImage(file);
  let scale = Math.min(1, CARD_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  for (let round = 0; round < 4; round++) {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not prepare the image');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const quality of [0.9, 0.82, 0.74, 0.66, 0.58]) {
      const blob = await canvasToJpeg(canvas, quality);
      if (blob && blob.size <= CARD_MAX_BYTES) return blob;
    }
    scale *= 0.85;
  }
  throw new Error('The image is too detailed to shrink. Try a simpler picture.');
}
