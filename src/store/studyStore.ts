import { create } from 'zustand';
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware';
import { supabase } from '@/lib/supabase/client';
import { blobToDataUrl, dataUrlToBlob } from '@/lib/studyImages';

export interface StudySubject {
  id: string;
  name: string;
  color: string;
  /** compressed JPEG data URL chosen by the user */
  image?: string;
  /** The server's updated_at when `image` was last matched with the server copy. */
  imageStamp?: string;
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
 *
 * The running timer lives on this device only. A finished session is saved to
 * the account when you press Stop.
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

const UUID_RE = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function addUnique(list: string[], id: string): string[] {
  return list.includes(id) ? list : [...list, id];
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

  /** The account this device's study data belongs to. */
  ownerId: string | null;
  /** Changes made on this device that are not on the server yet (or deletions still to be sent). */
  dirtySubjects: string[];
  dirtySessions: string[];
  deletedSubjects: string[];
  deletedSessions: string[];
  subscribed: boolean;

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

  /** Loads this account's subjects, pictures and history from Supabase. */
  hydrate: (userId?: string) => Promise<void>;
  /** Sends any waiting changes to Supabase. */
  flush: () => Promise<void>;
  subscribe: () => void;
  unsubscribe: () => void;
  /** Wipes the on-device copy (used on sign-out so the next person starts clean). */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Supabase plumbing
// ---------------------------------------------------------------------------

const BUCKET = 'subject-images';
const PAGE = 1000;
const STALE_MS = 5 * 60_000;

interface SubjectRow {
  id: string;
  name: string;
  color: string;
  image_path: string | null;
  created_at: string;
  updated_at: string;
}

interface SessionRow {
  id: string;
  subject_id: string;
  started_at: string;
  ended_at: string;
  duration_ms: number | string;
}

function imagePath(userId: string, subjectId: string): string {
  return `${userId}/${subjectId}.jpg`;
}

function sessionFromRow(r: SessionRow): StudySession {
  return {
    id: r.id,
    subjectId: r.subject_id,
    start: Date.parse(r.started_at),
    end: Date.parse(r.ended_at),
    durationMs: Number(r.duration_ms)
  };
}

async function fetchSubjects(): Promise<SubjectRow[] | null> {
  const { data, error } = await supabase
    .from('study_subjects')
    .select('id,name,color,image_path,created_at,updated_at');
  if (error || !data) return null;
  return data as SubjectRow[];
}

// Supabase returns at most 1000 rows per request, so read the history in pages.
async function fetchSessions(): Promise<SessionRow[] | null> {
  const all: SessionRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('study_sessions')
      .select('id,subject_id,started_at,ended_at,duration_ms')
      .order('ended_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !data) return null;
    all.push(...(data as SessionRow[]));
    if (data.length < PAGE) break;
  }
  return all;
}

async function downloadImages(items: Array<{ id: string; path: string; stamp: string }>): Promise<void> {
  for (const item of items) {
    try {
      const { data, error } = await supabase.storage.from(BUCKET).download(item.path);
      if (error || !data) continue;
      const dataUrl = await blobToDataUrl(data);
      useStudyStore.setState((s) => ({
        subjects: s.subjects.map((x) =>
          x.id === item.id && !s.dirtySubjects.includes(x.id) ? { ...x, image: dataUrl, imageStamp: item.stamp } : x
        )
      }));
    } catch {
      /* try again on the next sync */
    }
  }
}

/** Merges the server's subjects into the device copy. Unsent local changes win. */
function applySubjects(rows: SubjectRow[]): void {
  const st = useStudyStore.getState();
  const dirty = new Set(st.dirtySubjects);
  const deleted = new Set(st.deletedSubjects);
  const localById = new Map(st.subjects.map((s) => [s.id, s] as const));
  const remoteIds = new Set(rows.map((r) => r.id));
  const merged: StudySubject[] = [];
  const downloads: Array<{ id: string; path: string; stamp: string }> = [];

  for (const row of rows) {
    if (deleted.has(row.id)) continue;
    const mine = localById.get(row.id);
    if (mine && dirty.has(row.id)) {
      merged.push(mine);
      continue;
    }
    const subject: StudySubject = {
      id: row.id,
      name: row.name,
      color: row.color,
      createdAt: Date.parse(row.created_at),
      image: mine?.image,
      imageStamp: mine?.imageStamp
    };
    if (!row.image_path) {
      subject.image = undefined;
      subject.imageStamp = undefined;
    } else if (!mine?.image || mine.imageStamp !== row.updated_at) {
      downloads.push({ id: row.id, path: row.image_path, stamp: row.updated_at });
    }
    merged.push(subject);
  }
  for (const s of st.subjects) {
    if (dirty.has(s.id) && !remoteIds.has(s.id)) merged.push(s);
  }
  merged.sort((a, b) => a.createdAt - b.createdAt);

  const ids = new Set(merged.map((s) => s.id));
  useStudyStore.setState((s) => ({
    subjects: merged,
    sessions: s.sessions.filter((x) => ids.has(x.subjectId)),
    active: s.active && !ids.has(s.active.subjectId) ? null : s.active
  }));
  void downloadImages(downloads);
}

/** Merges the server's history into the device copy. Unsent local changes win. */
function applySessions(rows: SessionRow[]): void {
  const st = useStudyStore.getState();
  const dirty = new Set(st.dirtySessions);
  const deleted = new Set(st.deletedSessions);
  const remoteIds = new Set(rows.map((r) => r.id));
  const merged: StudySession[] = [];

  for (const r of rows) {
    if (deleted.has(r.id)) continue;
    merged.push(sessionFromRow(r));
  }
  for (const s of st.sessions) {
    if (dirty.has(s.id) && !remoteIds.has(s.id)) merged.push(s);
  }
  merged.sort((a, b) => a.end - b.end);

  const subjectIds = new Set(st.subjects.map((s) => s.id));
  useStudyStore.setState({ sessions: merged.filter((s) => subjectIds.has(s.subjectId)) });
}

async function flushOnce(): Promise<void> {
  const userId = useStudyStore.getState().ownerId;
  if (!userId) return;
  const clearSubject = (id: string): void =>
    useStudyStore.setState((s) => ({ dirtySubjects: s.dirtySubjects.filter((x) => x !== id) }));

  // 1. Deletions first: what a person deletes is removed from the server for good.
  for (const id of [...useStudyStore.getState().deletedSessions]) {
    const { error } = await supabase.from('study_sessions').delete().eq('id', id);
    if (!error) {
      useStudyStore.setState((s) => ({ deletedSessions: s.deletedSessions.filter((x) => x !== id) }));
    }
  }
  for (const id of [...useStudyStore.getState().deletedSubjects]) {
    // the picture file goes first, then the row (its sessions are removed with it)
    await supabase.storage.from(BUCKET).remove([imagePath(userId, id)]);
    const { error } = await supabase.from('study_subjects').delete().eq('id', id);
    if (!error) {
      useStudyStore.setState((s) => ({ deletedSubjects: s.deletedSubjects.filter((x) => x !== id) }));
    }
  }

  // 2. Subjects (and their pictures)
  for (const id of [...useStudyStore.getState().dirtySubjects]) {
    const subject = useStudyStore.getState().subjects.find((s) => s.id === id);
    if (!subject) {
      clearSubject(id);
      continue;
    }
    let path: string | null = null;
    let imageFailed = false;
    if (subject.image) {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(imagePath(userId, id), dataUrlToBlob(subject.image), { upsert: true, contentType: 'image/jpeg' });
      if (uploadError) imageFailed = true;
      else path = imagePath(userId, id);
    } else {
      await supabase.storage.from(BUCKET).remove([imagePath(userId, id)]);
    }
    const { data, error } = await supabase
      .from('study_subjects')
      .upsert({ id, user_id: userId, name: subject.name, color: subject.color, image_path: path })
      .select('updated_at')
      .single();
    if (error || !data) continue;
    const stamp = (data as { updated_at: string }).updated_at;
    useStudyStore.setState((s) => ({
      dirtySubjects: imageFailed ? s.dirtySubjects : s.dirtySubjects.filter((x) => x !== id),
      subjects: s.subjects.map((x) => (x.id === id && path ? { ...x, imageStamp: stamp } : x))
    }));
  }

  // 3. Sessions (the history), in batches
  const st = useStudyStore.getState();
  const dirtyIds = new Set(st.dirtySessions);
  const pending = st.sessions.filter((s) => dirtyIds.has(s.id));
  const known = new Set(st.sessions.map((s) => s.id));
  const stale = st.dirtySessions.filter((id) => !known.has(id));
  if (stale.length > 0) {
    useStudyStore.setState((s) => ({ dirtySessions: s.dirtySessions.filter((x) => known.has(x)) }));
  }
  for (let i = 0; i < pending.length; i += 100) {
    const chunk = pending.slice(i, i + 100);
    const { error } = await supabase.from('study_sessions').upsert(
      chunk.map((s) => ({
        id: s.id,
        user_id: userId,
        subject_id: s.subjectId,
        started_at: new Date(s.start).toISOString(),
        ended_at: new Date(s.end).toISOString(),
        duration_ms: Math.round(s.durationMs)
      })),
      { onConflict: 'id' }
    );
    if (error) break;
    const sent = new Set(chunk.map((s) => s.id));
    useStudyStore.setState((s) => ({ dirtySessions: s.dirtySessions.filter((x) => !sent.has(x)) }));
  }
}

let flushing = false;
let flushAgain = false;

async function runFlush(): Promise<void> {
  if (flushing) {
    flushAgain = true;
    return;
  }
  flushing = true;
  try {
    do {
      flushAgain = false;
      await flushOnce();
    } while (flushAgain);
  } catch {
    /* nothing is lost: whatever failed stays queued for the next try */
  } finally {
    flushing = false;
  }
}

let lastHydrateAt = 0;
let channel: ReturnType<typeof supabase.channel> | null = null;
let refreshTimer: number | undefined;

function scheduleSubjectsRefresh(): void {
  window.clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(async () => {
    const rows = await fetchSubjects();
    if (rows) applySubjects(rows);
  }, 400);
}

function onOnline(): void {
  void useStudyStore.getState().hydrate();
}

function onVisible(): void {
  if (document.visibilityState !== 'visible') return;
  const st = useStudyStore.getState();
  void st.flush();
  if (Date.now() - lastHydrateAt > STALE_MS) void st.hydrate();
}

const EMPTY_SYNC = {
  dirtySubjects: [] as string[],
  dirtySessions: [] as string[],
  deletedSubjects: [] as string[],
  deletedSessions: [] as string[]
};

/** Study data saved on this device before accounts synced it: make it this account's and queue it for upload. */
function adoptLegacy(userId: string): void {
  const idMap = new Map<string, string>();
  const fix = (id: string): string => {
    if (UUID_RE.test(id)) return id;
    let next = idMap.get(id);
    if (!next) {
      next = uid();
      idMap.set(id, next);
    }
    return next;
  };
  useStudyStore.setState((s) => {
    const subjects = s.subjects.map((x) => ({ ...x, id: fix(x.id) }));
    const sessions = s.sessions.map((x) => ({ ...x, id: fix(x.id), subjectId: fix(x.subjectId) }));
    return {
      ownerId: userId,
      subjects,
      sessions,
      active: s.active ? { ...s.active, subjectId: fix(s.active.subjectId) } : null,
      dirtySubjects: subjects.map((x) => x.id),
      dirtySessions: sessions.map((x) => x.id),
      deletedSubjects: [],
      deletedSessions: []
    };
  });
}

export const useStudyStore = create<StudyStore>()(
  persist(
    (set, get) => ({
      subjects: [],
      sessions: [],
      active: null,
      ownerId: null,
      ...EMPTY_SYNC,
      subscribed: false,

      addSubject: (name, color, image) => {
        const id = uid();
        set((state) => ({
          subjects: [...state.subjects, { id, name, color, image, createdAt: Date.now() }],
          dirtySubjects: addUnique(state.dirtySubjects, id)
        }));
        void get().flush();
        return id;
      },

      updateSubject: (id, changes) => {
        set((state) => ({
          subjects: state.subjects.map((s) => (s.id === id ? { ...s, ...changes } : s)),
          dirtySubjects: addUnique(state.dirtySubjects, id)
        }));
        void get().flush();
      },

      removeSubject: (id) => {
        set((state) => {
          const goneSessions = new Set(state.sessions.filter((s) => s.subjectId === id).map((s) => s.id));
          return {
            subjects: state.subjects.filter((s) => s.id !== id),
            sessions: state.sessions.filter((s) => s.subjectId !== id),
            active: state.active?.subjectId === id ? null : state.active,
            dirtySubjects: state.dirtySubjects.filter((x) => x !== id),
            dirtySessions: state.dirtySessions.filter((x) => !goneSessions.has(x)),
            deletedSubjects: addUnique(state.deletedSubjects, id)
          };
        });
        void get().flush();
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
          set((state) => ({
            sessions: [...state.sessions, session],
            active: null,
            dirtySessions: addUnique(state.dirtySessions, session.id)
          }));
          void get().flush();
        } else {
          set({ active: null });
        }
      },

      discard: () => set({ active: null }),

      removeSession: (id) => {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
          dirtySessions: state.dirtySessions.filter((x) => x !== id),
          deletedSessions: addUnique(state.deletedSessions, id)
        }));
        void get().flush();
      },

      hydrate: async (userId) => {
        const uidNow = userId ?? get().ownerId;
        if (!uidNow) return;
        const owner = get().ownerId;
        if (owner === null) {
          adoptLegacy(uidNow);
        } else if (owner !== uidNow) {
          // another account used this device before: never mix their data in
          set({ subjects: [], sessions: [], active: null, ownerId: uidNow, ...EMPTY_SYNC });
        }
        await runFlush();
        const [subjects, sessions] = await Promise.all([fetchSubjects(), fetchSessions()]);
        // a failed read (offline, expired session) must not look like "no subjects"
        if (!subjects || !sessions) return;
        applySubjects(subjects);
        applySessions(sessions);
        lastHydrateAt = Date.now();
      },

      flush: () => runFlush(),

      subscribe: () => {
        if (get().subscribed) return;
        channel = supabase
          .channel('study-sync')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'study_subjects' }, () =>
            scheduleSubjectsRefresh()
          )
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'study_sessions' }, (payload) => {
            const row = payload.new as unknown as SessionRow;
            const st = get();
            if (st.sessions.some((s) => s.id === row.id) || st.deletedSessions.includes(row.id)) return;
            if (!st.subjects.some((s) => s.id === row.subject_id)) {
              void st.hydrate();
              return;
            }
            const next = [...st.sessions, sessionFromRow(row)].sort((a, b) => a.end - b.end);
            set({ sessions: next });
          })
          .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'study_sessions' }, (payload) => {
            const id = (payload.old as { id?: string }).id;
            if (!id) return;
            set((state) => ({ sessions: state.sessions.filter((s) => s.id !== id) }));
          })
          .subscribe();
        window.addEventListener('online', onOnline);
        document.addEventListener('visibilitychange', onVisible);
        set({ subscribed: true });
      },

      unsubscribe: () => {
        if (channel) supabase.removeChannel(channel);
        channel = null;
        window.clearTimeout(refreshTimer);
        window.removeEventListener('online', onOnline);
        document.removeEventListener('visibilitychange', onVisible);
        set({ subscribed: false });
      },

      reset: () => {
        set({ subjects: [], sessions: [], active: null, ownerId: null, ...EMPTY_SYNC });
      }
    }),
    {
      name: 'tally-study-v1',
      version: 2,
      storage: createJSONStorage(() => safeStateStorage),
      // v1 kept everything on the device only; v2 adds the account link and the
      // queue of changes waiting to be sent. Old data is adopted by the first
      // account that signs in (see adoptLegacy).
      migrate: (persisted: unknown) =>
        ({
          ownerId: null,
          ...EMPTY_SYNC,
          ...((persisted as Record<string, unknown>) ?? {})
        }) as unknown as StudyStore,
      partialize: (state) => ({
        subjects: state.subjects,
        sessions: state.sessions,
        active: state.active,
        ownerId: state.ownerId,
        dirtySubjects: state.dirtySubjects,
        dirtySessions: state.dirtySessions,
        deletedSubjects: state.deletedSubjects,
        deletedSessions: state.deletedSessions
      })
    }
  )
);
