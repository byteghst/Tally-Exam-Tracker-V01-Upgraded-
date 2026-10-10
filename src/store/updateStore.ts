import { create } from 'zustand';
import { checkForUpdate, isSkipped, skipBuild, type UpdateInfo } from '@/lib/updateCheck';

type Phase = 'idle' | 'checking' | 'current' | 'available' | 'error';

interface UpdateState {
  phase: Phase;
  update: UpdateInfo | null;
  promptOpen: boolean;
  /** Automatic checks stay quiet; manual ones always report back. */
  check: (opts?: { manual?: boolean }) => Promise<void>;
  openPrompt: () => void;
  /** `skip` = "Later": don't pop the prompt again for this build (Settings still shows it). */
  closePrompt: (skip?: boolean) => void;
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  phase: 'idle',
  update: null,
  promptOpen: false,

  async check(opts) {
    const manual = opts?.manual ?? false;
    const previous = get().phase;
    if (previous === 'checking') return;

    set({ phase: 'checking' });
    const result = await checkForUpdate({ force: manual });

    if (result.status === 'available') {
      set({
        phase: 'available',
        update: result.update,
        promptOpen: manual || !isSkipped(result.update.build)
      });
    } else if (result.status === 'current') {
      set({ phase: 'current' });
    } else if (result.status === 'error' && manual) {
      set({ phase: 'error' });
    } else {
      // throttled, or a failed automatic check: keep whatever we knew before
      set({ phase: previous });
    }
  },

  openPrompt: () => set({ promptOpen: true }),

  closePrompt(skip = false) {
    const { update } = get();
    if (skip && update) skipBuild(update.build);
    set({ promptOpen: false });
  }
}));
