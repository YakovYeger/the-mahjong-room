import type { NextRequest } from 'next/server';
import { requireUser } from '../../../src/server/auth';
import { assertAccountOrigin } from '../../../src/server/account';
import { createSupabaseAdminClient } from '../../../src/lib/supabase/admin';
import { ApiError, handleApiError, noStoreJson, readJson } from '../../../src/server/http';
import { enforceRateLimit } from '../../../src/server/rate-limit';
import { friendActionSchema, friendsSchema, usernameSchema } from '../../../src/friends/contracts';
export const dynamic = 'force-dynamic';
function result(data: unknown, error: { message: string } | null) {
  if (error) {
    const known: Record<string,[number,string]> = {
      PROFILE_REQUIRED: [409,'Finish choosing your username in Account before adding friends.'],
      PLAYER_NOT_FOUND: [404,'No player has that username.'], SELF_REQUEST: [400,'This is your own profile.'],
      FRIEND_LIMIT: [409,'One of these accounts has reached the limit of 200 friends and requests.'],
      FRIENDSHIP_CHANGED: [409,'This request has changed. Refresh your list and try again.'],
    };
    const mapped = known[error.message];
    if (mapped) throw new ApiError(mapped[0],error.message,mapped[1]);
    throw new ApiError(503,'FRIENDS_UNAVAILABLE','Friends could not be loaded. Please try again.');
  }
  const parsed = friendsSchema.safeParse(data);
  if (!parsed.success) throw new ApiError(503,'FRIENDS_UNAVAILABLE','Friends returned an invalid response. Please try again.');
  return noStoreJson(parsed.data);
}
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const raw = request.nextUrl.searchParams.get('username');
    const username = raw === null ? null : usernameSchema.safeParse(raw);
    if (username && !username.success) throw new ApiError(400,'INVALID_USERNAME','Use an exact username: 3–24 letters, numbers, or underscores.');
    if (username) await enforceRateLimit('friend_lookup',user.id,30,900);
    const admin = createSupabaseAdminClient();
    if (!admin) throw new ApiError(503,'BACKEND_NOT_CONFIGURED','Friends are not configured yet.');
    const { data,error } = await admin.rpc('friends_snapshot',{actor:user.id,lookup_username:username?.success ? username.data : undefined});
    return result(data,error);
  } catch(error) { return handleApiError(error); }
}
export async function POST(request: NextRequest) {
  try {
    assertAccountOrigin(request);
    const user = await requireUser();
    const parsed = friendActionSchema.safeParse(await readJson(request,2048));
    if (!parsed.success) throw new ApiError(400,'INVALID_FRIEND_ACTION','Choose a valid player and friend action.');
    await enforceRateLimit(parsed.data.operation==='request'?'friend_request':'friend_action',user.id,parsed.data.operation==='request'?10:60,900);
    const admin = createSupabaseAdminClient();
    if (!admin) throw new ApiError(503,'BACKEND_NOT_CONFIGURED','Friends are not configured yet.');
    const {data,error} = await admin.rpc('change_friendship',{actor:user.id,target_username:parsed.data.username,operation:parsed.data.operation,expected_id:'connectionId' in parsed.data ? parsed.data.connectionId : undefined});
    return result(data,error);
  } catch(error) { return handleApiError(error); }
}
