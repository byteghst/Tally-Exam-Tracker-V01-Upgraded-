import { create } from 'zustand';
import {
  CARD_LIFETIME_MS,
  fetchLatestQuote,
  getSeenQuoteId,
  markQuoteSeen,
  type LatestQuote
} from '@/lib/quotes/api';

interface QuoteStore {
  open: boolean;
  loading: boolean;
  quote: LatestQuote | null;
  /** 'offline' | 'failed' when the latest quote could not be fetched, otherwise null */
  error: 'offline' | 'failed' | null;
  /** Opens the popup with the latest quote (notification tap, Settings button). */
  openLatest: () => Promise<void>;
  /** Opens the popup by itself, once, for a quote that arrived in the last 24 hours and was not seen yet. */
  checkForNew: () => Promise<void>;
  close: () => void;
}

export const useQuoteStore = create<QuoteStore>((set, get) => ({
  open: false,
  loading: false,
  quote: null,
  error: null,

  openLatest: async () => {
    set({ open: true, loading: true, error: null });
    try {
      const quote = await fetchLatestQuote();
      set({ quote, loading: false });
      if (quote) markQuoteSeen(quote.id);
    } catch {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      set({ loading: false, error: offline ? 'offline' : 'failed' });
    }
  },

  checkForNew: async () => {
    if (get().open) return;
    try {
      const quote = await fetchLatestQuote();
      if (!quote) return;
      const fresh = Date.now() - new Date(quote.sentAt).getTime() < CARD_LIFETIME_MS;
      if (!fresh || quote.id === getSeenQuoteId()) return;
      markQuoteSeen(quote.id);
      set({ open: true, loading: false, quote, error: null });
    } catch {
      /* a missed check is harmless; the next launch tries again */
    }
  },

  close: () => set({ open: false })
}));
