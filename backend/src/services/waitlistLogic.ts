import { supabase } from '../lib/supabase.js';

async function getEvent(eventId: string) {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .eq('uuid', eventId)
    .single();

  if (error || !data) {
    throw new Error(`Event not found: ${eventId}`);
  }

  return data;
}

async function getNoShowRate(eventId: string): Promise<number> {
  const { data } = await supabase
    .from('party')
    .select('status')
    .eq('event_uuid', eventId)
    .in('status', ['SEATED', 'NO_SHOW']);

  const finished = data ?? [];

  if (finished.length < 5) {
    const event = await getEvent(eventId);
    const raw = event.no_show_rate ?? 0.15;
    return raw > 1 ? raw / 100 : raw;
  }

  const noShows = finished.filter(p => p.status === 'NO_SHOW').length;
  return noShows / finished.length;
};

export async function calculateHeuristicWait(eventId: string): Promise<{
  estimatedWait: number;
  queueSize: number;
}> {
  const event = await getEvent(eventId);

  const waitPerParty = event.est_wait ?? 10;

  const { data: parties } = await supabase
    .from('party')
    .select('*')
    .eq('event_uuid', eventId)
    .eq('status', 'QUEUED');

  const queue = parties ?? [];

  const queueSize = queue.length;

  if (queueSize === 0) {
    return {
      estimatedWait: 0,
      queueSize: 0,
    };
  }

  let totalWeight = 0;

  for (const party of queue) {
    const weight = 1;

    totalWeight += weight;
  }

  const noShow = await getNoShowRate(eventId);

  const adjustedNoShow = noShow < 1 ? noShow : noShow / 100;

  const finalRaw = totalWeight * (1 - adjustedNoShow);

  const estimatedWait = Math.ceil(finalRaw * waitPerParty);

  return {
    estimatedWait,
    queueSize,
  };
}