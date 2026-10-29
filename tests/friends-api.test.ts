import { beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET, POST } from '../app/api/friends/route';
import { ApiError } from '../src/server/http';
const mock=vi.hoisted(()=>({user:vi.fn(),rpc:vi.fn(),rate:vi.fn()}));
vi.mock('../src/server/auth',()=>({requireUser:mock.user}));
vi.mock('../src/server/rate-limit',()=>({enforceRateLimit:mock.rate}));
vi.mock('../src/lib/supabase/admin',()=>({createSupabaseAdminClient:()=>({rpc:mock.rpc})}));
const id='10000000-0000-4000-8000-000000000001';
const profile={username:'alice',displayName:'Alice',memberSince:'2026-10-01T00:00:00Z',relationship:'self',connectionId:null};
const request=(body:unknown,origin='http://localhost')=>new NextRequest('http://localhost/api/friends',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();mock.user.mockResolvedValue({id});mock.rpc.mockResolvedValue({data:{self:profile,lookup:null,connections:[]},error:null});});
it('uses the authenticated identity and normalized exact username; never caches profiles',async()=>{
 const response=await GET(new NextRequest('http://localhost/api/friends?username=%20BOB%20'));
 expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store');
 expect(mock.rpc).toHaveBeenCalledWith('friends_snapshot',{actor:id,lookup_username:'bob'});
 expect(mock.rate).toHaveBeenCalledWith('friend_lookup',id,30,900);
});
it('rejects unauthenticated reads and cross-origin writes before database access',async()=>{
 mock.user.mockRejectedValue(new ApiError(401,'AUTH_REQUIRED','Sign in.'));
 expect((await GET(new NextRequest('http://localhost/api/friends'))).status).toBe(401);
 expect((await POST(request({username:'bob',operation:'request'},'https://elsewhere.test'))).status).toBe(403);
 expect(mock.rpc).not.toHaveBeenCalled();
});
it('rejects actor spoofing, wildcard lookups, unsupported operations, and missing version IDs',async()=>{
 for(const body of [{username:'bob',operation:'request',actor:'other'},{username:'bob',operation:'accept'},{username:'bob',operation:'delete'},{username:'b%',operation:'request'}])expect((await POST(request(body))).status).toBe(400);
 expect((await GET(new NextRequest('http://localhost/api/friends?username=b%25'))).status).toBe(400);
 expect(mock.rpc).not.toHaveBeenCalled();
});
it('passes only validated actions and the relationship version; rate-limits new requests separately',async()=>{
 await POST(request({username:'BOB',operation:'request'}));
 expect(mock.rpc).toHaveBeenCalledWith('change_friendship',{actor:id,target_username:'bob',operation:'request',expected_id:undefined});
 expect(mock.rate).toHaveBeenCalledWith('friend_request',id,10,900);
 const connectionId='20000000-0000-4000-8000-000000000001';await POST(request({username:'bob',operation:'accept',connectionId}));
 expect(mock.rpc).toHaveBeenLastCalledWith('change_friendship',{actor:id,target_username:'bob',operation:'accept',expected_id:connectionId});
});
it('maps stale actions and missing schema to recoverable responses without leaking database errors',async()=>{
 mock.rpc.mockResolvedValue({error:{message:'FRIENDSHIP_CHANGED'},data:null});expect((await POST(request({username:'bob',operation:'accept',connectionId:id}))).status).toBe(409);
 mock.rpc.mockResolvedValue({error:{message:'sensitive SQL diagnostic'},data:null});const response=await GET(new NextRequest('http://localhost/api/friends'));expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain('sensitive');
});
it('rejects malformed backend responses and oversized request bodies',async()=>{
 mock.rpc.mockResolvedValue({data:{self:null},error:null});expect((await GET(new NextRequest('http://localhost/api/friends'))).status).toBe(503);
 expect((await POST(request({username:'x'.repeat(3000),operation:'request'}))).status).toBe(413);
});
