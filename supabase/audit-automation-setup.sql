-- Apply through Supabase migrations. Does not start processing accounting records.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

create table if not exists public.audit_automation_config (
  id integer primary key check (id = 1),
  enabled boolean not null default false,
  model text not null default 'gpt-5.4-mini',
  worker_secret_hash text not null,
  updated_at timestamptz not null default now()
);
alter table public.audit_automation_config enable row level security;
revoke all on public.audit_automation_config from public, anon, authenticated;
grant select on public.audit_automation_config to service_role;

-- The plaintext worker token never leaves Vault/database-side HTTP requests.
do $$
begin
  if not exists (select 1 from vault.secrets where name = 'audit_worker_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'audit_worker_secret', 'Server-only Audit Data worker token');
  end if;
end $$;

insert into public.audit_automation_config (id, enabled, model, worker_secret_hash)
select 1, false, 'gpt-5.4-mini', encode(extensions.digest(decrypted_secret, 'sha256'), 'hex')
from vault.decrypted_secrets where name = 'audit_worker_secret'
on conflict (id) do update set worker_secret_hash = excluded.worker_secret_hash, updated_at = now();
