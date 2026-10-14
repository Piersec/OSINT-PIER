-- Additive target kind only; keep all rows, privileges, and RLS policies.
set lock_timeout = '5s';
alter table public.analysis_history
  drop constraint analysis_history_target_kind_check,
  add constraint analysis_history_target_kind_check check (
    target_kind in ('domain', 'ip', 'url', 'name', 'username', 'email', 'phone', 'cnpj')
  );
