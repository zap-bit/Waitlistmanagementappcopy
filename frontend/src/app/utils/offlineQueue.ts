export interface PendingOp {
  id: string;
  type: 'ADD_WAITLIST' | 'REMOVE_WAITLIST' | 'ADD_EVENT';
  localId: string;
  eventId?: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

const STORAGE_KEY = 'pendingOps';

export function getPendingOps(): PendingOp[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as PendingOp[];
  } catch {
    return [];
  }
}

export function queueOp(op: Omit<PendingOp, 'id' | 'timestamp'>): void {
  const ops = getPendingOps();
  ops.push({
    ...op,
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
}

export function removePendingOp(opId: string): void {
  const ops = getPendingOps().filter(op => op.id !== opId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
}

/** Remove all queued ADD_WAITLIST ops for a given local entry ID.
 *  Called when the user cancels before going online. */
export function cancelQueuedAdd(localId: string): void {
  const ops = getPendingOps().filter(op => !(op.type === 'ADD_WAITLIST' && op.localId === localId));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ops));
}

export async function flushPendingOps(
  token: string,
  apiBase: string,
  onIdResolved: (localId: string, remoteId: string, type: PendingOp['type']) => void,
): Promise<{ synced: number; errors: number }> {
  const ops = getPendingOps();
  if (!ops.length) return { synced: 0, errors: 0 };

  try {
    const res = await fetch(`${apiBase}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ operations: ops }),
    });

    if (!res.ok) return { synced: 0, errors: ops.length };

    const body = await res.json() as {
      synced: number;
      resolved: Array<{ localId: string; remoteId: string; type: string }>;
      errors: Array<{ localId: string; error: string }>;
    };

    const resolvedLocalIds = new Set(body.resolved.map(r => r.localId));
    const remaining = ops.filter(op => !resolvedLocalIds.has(op.localId));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));

    for (const r of body.resolved) {
      onIdResolved(r.localId, r.remoteId, r.type as PendingOp['type']);
    }

    return { synced: body.resolved.length, errors: body.errors.length };
  } catch {
    return { synced: 0, errors: ops.length };
  }
}
