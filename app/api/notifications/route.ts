import type { NextRequest } from 'next/server';
import { createSupabaseServerClient } from '../../../src/lib/supabase/server';
import { requireUser } from '../../../src/server/auth';
import { ApiError, handleApiError, noStoreJson, readJson } from '../../../src/server/http';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await requireUser();
    const supabase = await createSupabaseServerClient();
    if (!supabase) throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'Notifications are not configured.');
    const { data, error } = await supabase.from('player_notifications').select('id,game_id,kind,payload,read_at,created_at').order('created_at', { ascending: false }).limit(30);
    if (error) throw new ApiError(500, 'NOTIFICATIONS_UNAVAILABLE', 'Notifications could not be loaded.');
    return noStoreJson({ notifications: data ?? [] });
  } catch (error) { return handleApiError(error); }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireUser();
    const body = await readJson(request) as Record<string, unknown>;
    const id = typeof body.id === 'string' ? body.id : '';
    if (!id) throw new ApiError(400, 'NOTIFICATION_REQUIRED', 'Choose a notification.');
    const supabase = await createSupabaseServerClient();
    if (!supabase) throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'Notifications are not configured.');
    const { error } = await supabase.from('player_notifications').update({ read_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new ApiError(500, 'NOTIFICATION_UPDATE_FAILED', 'The notification could not be updated.');
    return noStoreJson({ ok: true });
  } catch (error) { return handleApiError(error); }
}
