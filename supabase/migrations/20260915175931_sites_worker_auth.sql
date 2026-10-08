-- Sites owner-only deployments reject external requests before they reach the
-- application. Keep the Sites bypass token encrypted in Vault and send it on
-- the dedicated dispatch header while retaining the app-level worker secret
-- in the standard Authorization header.
create or replace function private.invoke_turn_timeout_worker()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  endpoint_url text;
  worker_secret text;
  sites_bypass_token text;
  request_headers jsonb;
begin
  select decrypted_secret into endpoint_url
  from vault.decrypted_secrets
  where name = 'mahjong_turn_timeout_url'
  limit 1;

  select decrypted_secret into worker_secret
  from vault.decrypted_secrets
  where name = 'mahjong_turn_timeout_secret'
  limit 1;

  select decrypted_secret into sites_bypass_token
  from vault.decrypted_secrets
  where name = 'mahjong_sites_bypass_token'
  limit 1;

  if endpoint_url is null or worker_secret is null then
    return;
  end if;

  request_headers := jsonb_build_object(
    'content-type', 'application/json',
    'authorization', 'Bearer ' || worker_secret
  );

  if sites_bypass_token is not null then
    request_headers := request_headers || jsonb_build_object(
      'OAI-Sites-Authorization', 'Bearer ' || sites_bypass_token
    );
  end if;

  perform net.http_post(
    url := endpoint_url,
    headers := request_headers,
    body := '{}'::jsonb,
    timeout_milliseconds := 8000
  );
end;
$$;

revoke all on function private.invoke_turn_timeout_worker() from public, anon, authenticated;
grant execute on function private.invoke_turn_timeout_worker() to service_role;
