/**
 * Deterministic string -> positive 32-bit int hash (FNV-1a variant). Used
 * only to turn a reminder's string id ("exam-<uuid>") into the numeric id
 * Capacitor's LocalNotifications plugin requires — not for anything
 * security-sensitive, just needs to be stable and collision-unlikely for a
 * handful of items.
 */
export function hashToInt32(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  // force positive, and keep well under Java's int max (Capacitor/Android
  // notification ids are 32-bit signed ints under the hood)
  return Math.abs(hash) % 2147483647;
}
