import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { supabase } from '../lib/supabase.js';

export const syncRouter = Router();

syncRouter.use(requireAuth);

interface SyncOperation {
  type: 'ADD_WAITLIST' | 'REMOVE_WAITLIST' | 'ADD_EVENT';
  localId: string;
  eventId?: string;
  payload: Record<string, unknown>;
}

syncRouter.post('/', async (req, res, next) => {
  const operations: SyncOperation[] = req.body?.operations ?? [];
  if (!Array.isArray(operations)) {
    return next(new ApiError(400, 'INVALID_INPUT', 'operations must be an array'));
  }

  const resolved: Array<{ localId: string; remoteId: string; type: string }> = [];
  const errors: Array<{ localId: string; error: string }> = [];

  for (const op of operations) {
    try {
      switch (op.type) {
        case 'ADD_WAITLIST': {
          if (!op.eventId) { errors.push({ localId: op.localId, error: 'eventId required' }); break; }
          const { name, partySize, specialRequests } = op.payload as Record<string, unknown>;
          const trimmedName = String(name || '').trim();
          const size = Number(partySize);
          if (!trimmedName || !Number.isInteger(size) || size < 1) {
            errors.push({ localId: op.localId, error: 'invalid name or partySize' });
            break;
          }
          const { data, error } = await supabase
            .from('party')
            .insert({
              account_uuid: req.authUser!.id,
              event_uuid: op.eventId,
              party_size: size,
              special_req: [trimmedName, typeof specialRequests === 'string' ? specialRequests.trim() : ''].filter(Boolean).join(' | '),
            })
            .select('uuid')
            .single();
          if (error || !data) { errors.push({ localId: op.localId, error: error?.message ?? 'insert failed' }); break; }
          resolved.push({ localId: op.localId, remoteId: data.uuid, type: op.type });
          break;
        }

        case 'REMOVE_WAITLIST': {
          const remoteId = op.payload.remoteId as string | undefined;
          if (!remoteId) { errors.push({ localId: op.localId, error: 'remoteId required' }); break; }
          const { error } = await supabase.from('party').delete().eq('uuid', remoteId);
          if (error) { errors.push({ localId: op.localId, error: error.message }); break; }
          resolved.push({ localId: op.localId, remoteId, type: op.type });
          break;
        }

        case 'ADD_EVENT': {
          if (!req.authUser?.businessId) { errors.push({ localId: op.localId, error: 'business account required' }); break; }
          const p = op.payload as Record<string, unknown>;
          const eventType = p.event_type === 'TABLE' ? 'TABLE' : 'CAPACITY';
          const { data, error } = await supabase
            .from('events')
            .insert({
              account_uuid: req.authUser.businessId,
              name: String(p.name || '').trim(),
              event_type: eventType,
              archived: Boolean(p.archived ?? false),
              location: p.location ?? null,
              queue_capacity: p.queue_capacity ?? null,
              est_wait: p.est_wait ?? null,
              cap_type: p.cap_type ?? null,
              num_tables: p.num_tables ?? null,
              avg_size: p.avg_size ?? null,
              reservation_duration: p.reservation_duration ?? null,
              no_show_policy: p.no_show_policy ?? null,
            })
            .select('uuid')
            .single();
          if (error || !data) { errors.push({ localId: op.localId, error: error?.message ?? 'insert failed' }); break; }
          resolved.push({ localId: op.localId, remoteId: data.uuid, type: op.type });
          break;
        }

        default:
          errors.push({ localId: op.localId, error: `unknown operation type: ${(op as SyncOperation).type}` });
      }
    } catch (e) {
      errors.push({ localId: op.localId, error: String(e) });
    }
  }

  return res.json({
    synced: resolved.length,
    resolved,
    errors,
    resolvedAt: new Date().toISOString(),
  });
});
