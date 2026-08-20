create table if not exists public.analysis_history (
  id uuid primary key default gen_random_uuid(),
  target text not null check (char_length(target) between 1 and 2048),
  target_kind text not null check (
    target_kind in ('domain', 'ip', 'url', 'name', 'username', 'email', 'phone')
  ),
  total_count integer not null default 0 check (total_count between 0 and 100),
  success_count integer not null default 0 check (
    success_count between 0 and total_count
  ),
  attention_count integer not null default 0 check (
    attention_count between 0 and total_count
  ),
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists analysis_history_completed_at_idx
  on public.analysis_history (completed_at desc);

alter table public.analysis_history enable row level security;

drop policy if exists "service role manages analysis history" on public.analysis_history;
create policy "service role manages analysis history"
  on public.analysis_history
  for all
  to service_role
  using (true)
  with check (true);
