import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../src/lib/supabase/server';

export const dynamic = 'force-dynamic';

function validProgressPayload(body: Record<string, unknown> | null) {
  if (!body) return false;
  const wholeNumber = (value: unknown) => typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value);
  if (!wholeNumber(body.games_completed) || (body.games_completed as number) < 0) return false;
  if (!wholeNumber(body.current_assistance_level) || (body.current_assistance_level as number) < 0 || (body.current_assistance_level as number) > 4) return false;
  if (!wholeNumber(body.experience_points) || (body.experience_points as number) < 0) return false;
  if (!body.skills_json || typeof body.skills_json !== 'object' || Array.isArray(body.skills_json)) return false;
  return Object.values(body.skills_json).every((score) => typeof score === 'number' && Number.isFinite(score) && score >= 0 && score <= 100);
}

async function authenticatedClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { supabase, user: data.user };
}

export async function GET() {
  const auth = await authenticatedClient();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await auth.supabase.from('player_progress').select('*').eq('user_id', auth.user.id).maybeSingle();
  if (error) return NextResponse.json({ error: 'Progress unavailable' }, { status: 500 });
  return NextResponse.json({ progress: data });
}

export async function PUT(request: Request) {
  const auth = await authenticatedClient();
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!validProgressPayload(body)) {
    return NextResponse.json({ error: 'Invalid progress payload' }, { status: 400 });
  }
  const progress = body as {
    games_completed: number;
    current_assistance_level: number;
    experience_points: number;
    skills_json: Record<string, number>;
  };
  const payload = {
    user_id: auth.user.id,
    games_completed: progress.games_completed,
    current_assistance_level: progress.current_assistance_level,
    experience_points: progress.experience_points,
    skills_json: progress.skills_json,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await auth.supabase.from('player_progress').upsert(payload, { onConflict: 'user_id' }).select().single();
  if (error) return NextResponse.json({ error: 'Progress could not be saved' }, { status: 500 });
  return NextResponse.json({ progress: data });
}
