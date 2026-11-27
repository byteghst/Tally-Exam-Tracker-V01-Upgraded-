import { useSyncExternalStore } from 'react';
import { getAccent, resetAccent, setAccent, subscribeAccent } from '@/lib/accent';

/** The chosen accent ("#RRGGBB", or null for the built-in default) plus setters. Re-renders live. */
export function useAccent() {
  const accent = useSyncExternalStore(subscribeAccent, getAccent, () => null);
  return { accent, isDefault: accent === null, setAccent, resetAccent };
}
