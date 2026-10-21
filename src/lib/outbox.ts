import { create } from 'zustand';
import { supabase } from '@/lib/supabase/client';
import { useUIStore } from '@/store/uiStore';

/**
 * Changes made while offline (exams, tasks, deadlines) are kept here, on the
 * device, and sent to the account in order once a connection exists.
 *
 * - The store applies the change to what's on screen straight away.
 * - Several edits to the same row are merged into one; adding then deleting a
 *   row that never reached the account cancels out.
 * - A change the account rejects (not a connection problem) is dropped and the
 *   person is told, so one bad change can never block the rest of the queue.
 */
export type OutboxTable = 'exams' | 'tasks' | 'deadlines';

type Row = Record<string, unknown>;

export type OutboxOp =
  | { id: string; table: OutboxTable; kind: 'insert'; rowId: string; row: Row }
  | { id: string; table: OutboxTable; kind: 'update'; rowId: string; row: Row }
  | { id: string; table: OutboxTable; kind: 'delete'; rowId: string };

export type NewOutboxOp =
  | { table: OutboxTable; kind: 'insert'; rowId: string; row: Row }
  | { table: OutboxTable; kind: 'update'; rowId: string; row: Row }
  | { table: OutboxTable; kind: 'delete'; rowId: string };

const PREFIX = 'tally-outbox-v1:';

/** Number of changes still waiting to reach the account (drives the banner). */
export const useOutboxStore = create<{ pending: number }>(() => ({ pending: 0 }));

function read(userId: string): OutboxOp[] {
  try {
    const raw = localStorage.getItem(PREFIX + userId);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as OutboxOp[]) : [];
  } catch {
    return [];
  }
}

function write(userId: string, ops: OutboxOp[]): void {
  try {
    if (ops.length === 0) localStorage.removeItem(PREFIX + userId);
    else localStorage.setItem(PREFIX + userId, JSON.stringify(ops));
  } catch {
    /* storage full or unavailable */
  }
  useOutboxStore.setState({ pending: ops.length });
}

export function pendingCount(userId: string): number {
  return read(userId).length;
}

/** Syncs the banner's count with what is stored for this account. */
export function loadOutboxCount(userId: string): void {
  useOutboxStore.setState({ pending: read(userId).length });
}

/** A client-side id, so a row created offline keeps the same id once it syncs. */
export function makeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r % 4) + 8).toString(16);
  });
}

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * True when a failed request never reached the server (no connection), as
 * opposed to the server answering with a refusal. The SDK reports a failed
 * fetch with status 0 and no error code.
 */
export function isNetworkFailure(error: { code?: string } | null, status: number): boolean {
  if (!error) return false;
  return status === 0 || !error.code;
}

let inflightId: string | null = null;

export function enqueue(userId: string, op: NewOutboxOp): void {
  let ops = read(userId);
  // The change currently being sent can't be merged into; later edits queue after it.
  const sameRow = (o: OutboxOp): boolean => o.table === op.table && o.rowId === op.rowId && o.id !== inflightId;
  const entry = { id: makeId(), ...op } as OutboxOp;

  if (op.kind === 'update') {
    const idx = ops.findIndex((o) => sameRow(o) && o.kind !== 'delete');
    const target = idx >= 0 ? ops[idx] : undefined;
    if (target && target.kind !== 'delete') {
      ops[idx] = { ...target, row: { ...target.row, ...op.row } };
    } else {
      ops.push(entry);
    }
  } else if (op.kind === 'delete') {
    const neverSent = ops.some((o) => sameRow(o) && o.kind === 'insert');
    ops = ops.filter((o) => !sameRow(o));
    if (!neverSent) ops.push(entry);
  } else {
    ops.push(entry);
  }
  write(userId, ops);
}

type SendResult = 'ok' | 'retry' | 'rejected';

function classify(res: { error: { code?: string } | null; status: number }, op: OutboxOp): SendResult {
  const { error, status } = res;
  if (!error) return 'ok';
  // Already inserted by an earlier attempt whose reply never arrived.
  if (op.kind === 'insert' && error.code === '23505') return 'ok';
  if (isNetworkFailure(error, status) || status === 401) return 'retry';
  return 'rejected';
}

async function send(op: OutboxOp): Promise<SendResult> {
  try {
    if (op.kind === 'insert') return classify(await supabase.from(op.table).insert(op.row), op);
    if (op.kind === 'update') return classify(await supabase.from(op.table).update(op.row).eq('id', op.rowId), op);
    return classify(await supabase.from(op.table).delete().eq('id', op.rowId), op);
  } catch {
    return 'retry';
  }
}

async function run(userId: string): Promise<number> {
  let sent = 0;
  let rejected = 0;
  for (;;) {
    const op = read(userId)[0];
    if (!op) break;
    inflightId = op.id;
    let result: SendResult;
    try {
      result = await send(op);
    } finally {
      inflightId = null;
    }
    // Still no connection: stop here and try again later, keeping the order.
    if (result === 'retry') break;
    write(
      userId,
      read(userId).filter((o) => o.id !== op.id)
    );
    if (result === 'ok') sent += 1;
    else rejected += 1;
  }
  if (rejected > 0) {
    useUIStore
      .getState()
      .pushToast(
        rejected === 1 ? 'A change made offline could not be saved.' : `${rejected} changes made offline could not be saved.`,
        undefined,
        'error'
      );
  }
  return sent;
}

let running: Promise<number> | null = null;

/** Sends everything waiting, oldest first. Safe to call often; only one run happens at a time. */
export function flushOutbox(userId: string): Promise<number> {
  if (running) return running;
  running = run(userId).finally(() => {
    running = null;
  });
  return running;
}
