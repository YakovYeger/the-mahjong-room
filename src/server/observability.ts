import { createSupabaseAdminClient } from '../lib/supabase/admin';
import type { Json } from '../lib/supabase/database.types';

interface OperationalEvent {
  eventType: string;
  gameId?: string | null;
  userId?: string | null;
  stateVersion?: number | null;
  durationMs?: number | null;
  metadata?: Record<string, unknown>;
}

export async function recordOperationalEvent(event: OperationalEvent) {
  console.info(JSON.stringify({ source: 'mahjong-room', ...event, recordedAt: new Date().toISOString() }));
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  await admin.rpc('record_operational_event', {
    event_type_value: event.eventType,
    game_id_value: event.gameId ?? undefined,
    user_id_value: event.userId ?? undefined,
    state_version_value: event.stateVersion ?? undefined,
    duration_ms_value: event.durationMs ?? undefined,
    metadata_value: JSON.parse(JSON.stringify(event.metadata ?? {})) as Json,
  });
}
