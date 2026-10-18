import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';
import { useStudyStore } from '@/store/studyStore';

interface AuthStore {
  session: Session | null;
  user: User | null;
  /** true until the initial getSession() call resolves */
  initializing: boolean;
  error: string | null;
  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string; needsEmailConfirm?: boolean }>;
  signOut: () => Promise<void>;
}

let listenerAttached = false;

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  user: null,
  initializing: true,
  error: null,

  init: async () => {
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, user: data.session?.user ?? null, initializing: false });

    if (!listenerAttached) {
      listenerAttached = true;
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ session, user: session?.user ?? null });
      });
    }
  },

  signIn: async (email, password) => {
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
    await supabase.auth.signOut();
    useStudyStore.getState().reset();
    set({ session: null, user: null });
  }
}));
