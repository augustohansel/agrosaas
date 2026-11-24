begin;

alter table public.plots add column if not exists color text
  check (color ~ '^#[0-9a-fA-F]{6}$');
grant insert (color), update (color) on public.plots to authenticated;

create table if not exists public.map_preferences (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  base_map text not null default 'satellite' check (base_map in ('satellite', 'street')),
  map_layer smallint not null default -1 check (map_layer between -1 and 2)
);
alter table public.map_preferences enable row level security;
revoke all on public.map_preferences from public, anon, authenticated;
grant select, insert (base_map, map_layer), update (base_map, map_layer)
  on public.map_preferences to authenticated;
drop policy if exists own_preferences on public.map_preferences;
create policy own_preferences on public.map_preferences for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

commit;
