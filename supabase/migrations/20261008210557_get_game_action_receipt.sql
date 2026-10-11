-- Receipts are server-only and may contain the acting player's concealed rack.
create or replace function public.get_game_action_receipt(
  requested_game_id uuid,
  requested_action_id uuid,
  requesting_user_id uuid,
  request_hash_value text
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  receipt private.game_actions;
begin
  select * into receipt from private.game_actions where action_id = requested_action_id;
  if receipt.action_id is null then return null; end if;
  if receipt.game_id <> requested_game_id
    or receipt.user_id is distinct from requesting_user_id
    or receipt.request_hash is distinct from request_hash_value then
    raise exception using errcode = '23505', message = 'ACTION_ID_REUSED';
  end if;
  return jsonb_build_object('duplicate', true, 'status', receipt.response_status, 'response', receipt.response_json);
end;
$$;
revoke all on function public.get_game_action_receipt(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.get_game_action_receipt(uuid, uuid, uuid, text) to service_role;
