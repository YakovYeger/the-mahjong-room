import type { EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '../../../src/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const redirectTo = request.nextUrl.clone();
  redirectTo.pathname = '/account';
  redirectTo.search = '';

  const tokenHash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type') as EmailOtpType | null;
  const supabase = await createSupabaseServerClient();
  if (supabase && tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(redirectTo);
  }

  redirectTo.searchParams.set('auth_error', 'invalid_link');
  return NextResponse.redirect(redirectTo);
}
