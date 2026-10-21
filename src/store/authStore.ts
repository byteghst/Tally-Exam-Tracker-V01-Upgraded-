import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { clearStoredSession, readStoredSession, supabase } from '@/lib/supabase/client';
import { clearSnapshots } from '@/lib/offlineCache';
import { flushOutbox } from '@/lib/outbox';
import { useStudyStore } from '@/store/studyStore';

interface AuthStore {
  session: Session | null;
  user: User | null;
  /** true until we know whether someone is signed in (instant when a login is saved on the device) */
  initializing: boolean;
  error: string | null;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string; needsEmailConfirm?: boolean }>;
  signOut: () => Promise<void>;
}

let listenerAttached = false;

/** How long the app waits for the server to confirm the login before opening anyway. */
const SESSION_CHECK_TIMEOUT_MS = 4000;

const OFFLINE_MESSAGE = 'You are offline. Connect to the internet to continue.';

function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  session: null,
  user: null,
  initializing: true,
  error: null,

  init: async () => {
    // Open straight from the login saved on this device. This part runs before the
    // first await, so it is in place synchronously — no waiting on the network.
    const stored = readStoredSession();
    if (stored) set({ session: stored, user: stored.user, initializing: false });

    if (!listenerAttached) {
      listenerAttached = true;
      supabase.auth.onAuthStateChange((event, session) => {
        // Offline, the SDK can report "no session" just because it could not refresh
        // the token. Only a real sign-out may clear the login.
        if (!session && event !== 'SIGNED_OUT') return;
        set({ session, user: session?.user ?? null });
      });
    }

    // Confirm with the SDK in the background (refreshes an expired token when a
    // connection exists). Never let a slow or missing network hold the app up.
    try {
      const result = await Promise.race([
        supabase.auth.getSession(),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), SESSION_CHECK_TIMEOUT_MS))
      ]);
      if (result && result.data.session) {
        set({ session: result.data.session, user: result.data.session.user });
      } else if (result && !result.error) {
        // Answered cleanly with no session: genuinely signed out.
        set({ session: null, user: null });
      }
      // Timed out, or failed on the network: keep the saved login as it is.
    } catch {
      /* keep the saved login */
    }
    set({ initializing: false });
  },

  signIn: async (email, password) => {
    if (isOffline()) {
      set({ error: OFFLINE_MESSAGE });
      return { error: OFFLINE_MESSAGE };
    }
    set({ error: null });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      set({ error: error.message });
      return { error: error.message };
    }
    set({ session: data.session, user: data.user });
    return {};
  },

  signUp: async (email, password) => {
    if (isOffline()) {
      set({ error: OFFLINE_MESSAGE });
      return { error: OFFLINE_MESSAGE };
    }
    set({ error: null });
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      set({ error: error.message });
      return { error: error.message };
    }
    // If email confirmation is required, Supabase returns a user but no session.
    if (data.user && !data.session) {
      return { needsEmailConfirm: true };
    }
    set({ session: data.session, user: data.user });
    return {};
  },

  signOut: async () => {
    // Send any changes still waiting (give it a few seconds at most). Anything
    // that can't be sent stays on the device under this account and goes out the
    // next time the same account is signed in.
    const userId = get().user?.id;
    if (userId) {
      try {
        await Promise.race([flushOutbox(userId), new Promise<void>((resolve) => setTimeout(resolve, 4000))]);
      } catch {
        /* signing out matters more than a late sync */
      }
    }
    // Send any study changes still waiting (give it a few seconds at most),
    // then wipe the on-device study copy so the next person starts clean.
    try {
      await Promise.race([
        useStudyStore.getState().flush(),
        new Promise<void>((resolve) => setTimeout(resolve, 4000))
      ]);
    } catch {
      /* signing out matters more than a late sync */
    }
    try {
      await Promise.race([supabase.auth.signOut(), new Promise<void>((resolve) => setTimeout(resolve, 4000))]);
    } catch {
      /* offline: the saved login is removed below either way */
    }
    // The SDK cannot remove the saved login while offline, so do it here; otherwise
    // the next launch would sign the person straight back in.
    clearStoredSession();
    clearSnapshots();
    useStudyStore.getState().reset();
    set({ session: null, user: null });
  }
}));
