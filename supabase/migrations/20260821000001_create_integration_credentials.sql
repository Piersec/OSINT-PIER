-- The API stores only authenticated ciphertext here. The encryption key remains
-- exclusively in the backend environment and is never sent to Supabase clients.
create table if not exists public.integration_credentials (
  name text primary key check (name ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  version smallint not null default 1 check (version = 1),
  algorithm text not null default 'aes-256-gcm' check (algorithm = 'aes-256-gcm'),
  iv text not null,
  auth_tag text not null,
  ciphertext text not null,
  updated_at timestamptz not null default now()
);

create index if not exists integration_credentials_updated_at_idx
  on public.integration_credentials (updated_at desc);

alter table public.integration_credentials enable row level security;

-- This table is intentionally server-only. No browser role receives access.
revoke all on table public.integration_credentials from public, anon, authenticated;
grant select, insert, update, delete on table public.integration_credentials to service_role;

drop policy if exists "service role manages integration credentials"
  on public.integration_credentials;
create policy "service role manages integration credentials"
  on public.integration_credentials
  for all
  to service_role
  using (true)
  with check (true);
