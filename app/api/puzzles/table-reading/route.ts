import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../../src/lib/supabase/server';
import { validTableAttempts } from '../../../../src/persistence/table-attempts';
import { puzzleDate } from '../../../../src/game/puzzle-catalog';

export const dynamic = 'force-dynamic';

async function authenticatedClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  return error || !data.user ? null : { supabase, user: data.user };
}

async function readAttempts(auth: NonNullable<Awaited<ReturnType<typeof authenticatedClient>>>) {
  const { data, error } = await auth.supabase.from('table_reading_attempts')
    .select('puzzle_date,tile_id').eq('user_id', auth.user.id);
  if (error) return NextResponse.json({ error: 'Could not read puzzle progress.' }, { status: 500 });
  return NextResponse.json({
    userId: auth.user.id,
    attempts: Object.fromEntries(data.map(row => [row.puzzle_date, row.tile_id])),
  }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function GET() {
  const auth = await authenticatedClient();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return readAttempts(auth);
}

export async function POST(request: Request) {
  const auth = await authenticatedClient();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || body.userId !== auth.user.id) {
    return NextResponse.json({ error: 'Your account changed. Reload to continue.' }, { status: 409 });
  }
  if (!validTableAttempts(body.attempts, puzzleDate())) {
    return NextResponse.json({ error: 'Invalid puzzle answers.' }, { status: 400 });
  }
  const rows = Object.entries(body.attempts).map(([date, tileId]) => ({
    user_id: auth.user.id, puzzle_date: date, tile_id: tileId,
  }));
  if (rows.length) {
    const { error } = await auth.supabase.from('table_reading_attempts')
      .upsert(rows, { onConflict: 'user_id,puzzle_date', ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: 'Could not save puzzle progress.' }, { status: 500 });
  }
  return readAttempts(auth);
}
