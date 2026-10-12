import { create } from 'zustand';

export interface Toast {
  id: string;
  message: string;
  tone: 'success' | 'error';
  action?: { label: string; onClick: () => void };
}

interface UIStore {
  commandPaletteOpen: boolean;
  quickAddOpen: boolean;
  toasts: Toast[];
  setCommandPaletteOpen: (open: boolean) => void;
  setQuickAddOpen: (open: boolean) => void;
  pushToast: (message: string, action?: Toast['action'], tone?: Toast['tone']) => void;
  dismissToast: (id: string) => void;
}

/** How long a message stays on screen. ToastStack's draining line uses the same value. */
export const TOAST_DURATION_MS = 4000;
/** At most this many messages are shown at once; the oldest is dropped first. */
const MAX_TOASTS = 3;

export const useUIStore = create<UIStore>((set, get) => ({
  commandPaletteOpen: false,
  quickAddOpen: false,
  toasts: [],

  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
  setQuickAddOpen: (open) => set({ quickAddOpen: open }),

  pushToast: (message, action, tone = 'success') => {
    const id = crypto.randomUUID();
    set({ toasts: [...get().toasts, { id, message, action, tone }].slice(-MAX_TOASTS) });
    setTimeout(() => get().dismissToast(id), TOAST_DURATION_MS);
  },

  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) })
}));
