-- A integração de campo grava leituras; membros da propriedade consultam o quadro.
create table public.field_operations (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  plot_id uuid references public.plots(id) on delete set null,
  operation text not null,
  machine text not null,
  starts_at timestamptz not null,
  progress numeric not null check (progress between 0 and 100),
  service_hours numeric,
  input_name text,
  input_unit text,
  available numeric check (available >= 0),
  required_qty numeric check (required_qty >= 0),
  updated_at timestamptz not null default now()
);
create index field_operations_farm_start on public.field_operations(farm_id, starts_at);
alter table public.field_operations enable row level security;
revoke all on public.field_operations from anon, authenticated;
grant select on public.field_operations to authenticated;
create policy "Members read operations of their farms" on public.field_operations
for select to authenticated using (
  exists (select 1 from public.farm_members fm
          where fm.farm_id = field_operations.farm_id and fm.user_id = (select auth.uid()))
);
