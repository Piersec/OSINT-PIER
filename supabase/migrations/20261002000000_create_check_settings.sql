create table if not exists public.check_settings (
  check_id text primary key check (check_id ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.check_settings enable row level security;

revoke all on table public.check_settings from public, anon, authenticated;
grant select, insert, update, delete on table public.check_settings to service_role;
