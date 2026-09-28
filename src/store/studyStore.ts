import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';

export interface StudySubject {
  id: string;
  name: string;
  color: string;
  /** compressed JPEG data URL chosen by the user */
  image?: string;
  createdAt: number;
}

export interface StudySession {
  id: string;
  subjectId: string;
  start: number;
  end: number;
  durationMs: number;
}

/**
 * The running (or paused) timer. It stores wall-clock timestamps instead of
 * a ticking counter, so it keeps counting correctly while the app is in the
 * background, the screen is off, or Android has closed the app entirely:
 * elapsed = accumulatedMs + (now - startedAt).
 */
export interface ActiveTimer {
  subjectId: string;
  /** epoch ms when the current run began; null while paused */
  startedAt: number | null;
  /** time banked from earlier runs before a pause */
  accumulatedMs: number;
  /** epoch ms when this study session first started */
  sessionStart: number;
}

export function elapsedMs(timer: ActiveTimer, now: number = Date.now()): number {
  return timer.accumulatedMs + (timer.startedAt !== null ? Math.max(0, now - timer.startedAt) : 0);
}

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

// localStorage can throw (private mode, full quota). Never let that crash the app.
const safeStateStorage: StateStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* storage full or unavailable */
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
};

interface StudyStore {
  subjects: StudySubject[];
  sessions: StudySession[];
  active: ActiveTimer | null;

  addSubject: (name: string, color: string, image?: string) => string;
  updateSubject: (id: string, changes: Partial<Pick<StudySubject, 'name' | 'color' | 'image'>>) => void;
  removeSubject: (id: string) => void;

  /** Starts studying a subject. If another subject is running, it is saved first. */
  start: (subjectId: string) => void;
  pause: () => void;
  resume: () => void;
  /** Saves the current session and clears the timer. */
  stop: () => void;
  /** Throws the current session away without saving. */
  discard: () => void;
  removeSession: (id: string) => void;
}

export const useStudyStore = create<StudyStore>()(
  persist(
    (set, get) => ({
      subjects: [],
      sessions: [],
      active: null,

      addSubject: (name, color, image) => {
        const id = uid();
        set((state) => ({
          subjects: [...state.subjects, { id, name, color, image, createdAt: Date.now() }]
        }));
        return id;
      },

      updateSubject: (id, changes) => {
        set((state) => ({
          subjects: state.subjects.map((s) => (s.id === id ? { ...s, ...changes } : s))
        }));
      },

      removeSubject: (id) => {
        set((state) => ({
          subjects: state.subjects.filter((s) => s.id !== id),
          sessions: state.sessions.filter((s) => s.subjectId !== id),
          active: state.active?.subjectId === id ? null : state.active
        }));
      },

      start: (subjectId) => {
        const current = get().active;
        if (current?.subjectId === subjectId) {
          if (current.startedAt === null) get().resume();
          return;
        }
        if (current) get().stop();
        const now = Date.now();
        set({ active: { subjectId, startedAt: now, accumulatedMs: 0, sessionStart: now } });
      },

      pause: () => {
        const current = get().active;
        if (!current || current.startedAt === null) return;
        const now = Date.now();
        set({
          active: {
            ...current,
            accumulatedMs: current.accumulatedMs + Math.max(0, now - current.startedAt),
            startedAt: null
          }
        });
      },

      resume: () => {
        const current = get().active;
        if (!current || current.startedAt !== null) return;
        set({ active: { ...current, startedAt: Date.now() } });
      },

      stop: () => {
        const current = get().active;
        if (!current) return;
        const now = Date.now();
        const duration = elapsedMs(current, now);
        if (duration >= 1000) {
          const session: StudySession = {
            id: uid(),
            subjectId: current.subjectId,
            start: current.sessionStart,
            end: now,
            durationMs: duration
          };
          set((state) => ({ sessions: [...state.sessions, session], active: null }));
        } else {
          set({ active: null });
        }
      },

      discard: () => set({ active: null }),

      removeSession: (id) => {
        set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) }));
      }
    }),
    {
      name: 'tally-study-v1',
      version: 1,
      storage: createJSONStorage(() => safeStateStorage),
      partialize: (state) => ({
        subjects: state.subjects,
        sessions: state.sessions,
        active: state.active
      })
    }
  )
);
