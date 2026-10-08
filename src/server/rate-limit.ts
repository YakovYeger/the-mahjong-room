import { createSupabaseAdminClient } from '../lib/supabase/admin';
import { ApiError } from './http';

export async function enforceRateLimit(bucket: string, subject: string, limit: number, windowSeconds: number) {
  const admin = createSupabaseAdminClient();
  if (!admin) throw new ApiError(503, 'BACKEND_NOT_CONFIGURED', 'Account services are not configured yet.');
  const { data, error } = await admin.rpc('consume_rate_limit', {
    bucket_value: bucket,
    subject_value: subject,
    limit_value: limit,
    window_seconds: windowSeconds,
  });
  if (error) throw new ApiError(503, 'RATE_LIMIT_UNAVAILABLE', 'Please try again shortly.');
  if (!data) throw new ApiError(429, 'RATE_LIMITED', 'Too many attempts. Please wait and try again.');
}
