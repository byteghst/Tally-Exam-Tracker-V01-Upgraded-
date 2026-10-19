import { useSyncExternalStore } from 'react';

/**
 * One shared one-second clock for every live countdown on screen. The timer
 * only runs while at least one countdown is mounted, so a list of twenty
 * deadlines costs one interval, not twenty, and nothing ticks on screens
 * without a countdown.
 */
const listeners = new Set<() => void>();
let snapshot = Date.now();
let timer: number | undefined;

function emit() {
  snapshot = Date.now();
  listeners.forEach((listener) => listener());
}

// Timers are throttled while the app is in the background; catch up the
// moment it comes back so the numbers are never stale.
function onVisibility() {
  if (document.visibilityState === 'visible') emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    emit();
    timer = window.setInterval(emit, 1000);
    document.addEventListener('visibilitychange', onVisibility);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.clearInterval(timer);
      timer = undefined;
      document.removeEventListener('visibilitychange', onVisibility);
    }
  };
}

function getSnapshot() {
  // With nobody listening the stored time can be old; refresh it, but at most
  // once a second so repeated reads in one render return the same value.
  if (listeners.size === 0 && Date.now() - snapshot > 1000) snapshot = Date.now();
  return snapshot;
}

/** The current time in ms, updated every second while the component is mounted. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
