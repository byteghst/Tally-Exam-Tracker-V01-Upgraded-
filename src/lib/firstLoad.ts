/**
 * True only while a list is being read for the very first time and nothing has
 * loaded yet. Pages use it to show the Tally loader instead of an "empty" message
 * that would otherwise flash before the data arrives. Reads the flags defensively
 * so it works with any of the data stores.
 */
export function isFirstLoad(state: unknown): boolean {
  const s = state as { loading?: boolean; loaded?: boolean };
  return Boolean(s.loading) && !s.loaded;
}
