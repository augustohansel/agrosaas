-- Supabase/PostgreSQL 15+. Aplicar após 202611200001, sobre a base existente.
begin;

create schema agro_internal;
revoke all on schema agro_internal from public;
create type public.input_family as enum ('seed','pesticide','fertilizer','adjuvant','fuel');
create type public.job_kind as enum ('planting','spraying','fertilizing','harvesting');
create type public.job_state as enum ('planned','running','completed','cancelled');
create type public.meter_kind as enum ('hours','km');
create type public.storage_kind as enum ('silo','cooperative','trader');
create type public.bill_kind as enum ('payable','receivable');
create type public.cost_basis as enum ('direct','inventory','equipment','sale','other');
create type public.stock_event as enum ('receipt','work_order','refuel');

-- Chaves compostas impedem misturar fazendas inclusive por meio das RPCs.
alter table public.plots add unique(farm_id,id);
alter table public.transactions drop constraint transactions_plot_id_fkey,
  add constraint transactions_plot_id_fkey foreign key(farm_id,plot_id) references public.plots(farm_id,id);
alter table public.field_operations drop constraint field_operations_plot_id_fkey,
  add foreign key (farm_id,plot_id) references public.plots(farm_id,id) on delete set null (plot_id);

create table public.seasons (
  id uuid primary key default gen_random_uuid(), farm_id uuid not null references public.farms,
  name text not null check(trim(name)<>''), starts_on date not null, ends_on date not null,
  active boolean not null default false, check(ends_on>=starts_on), unique(farm_id,name),unique(farm_id,id)
);
create unique index seasons_one_active on public.seasons(farm_id) where active;
create table public.crop_cycles (
  id uuid primary key default gen_random_uuid(), farm_id uuid not null, season_id uuid not null, plot_id uuid not null,
  crop text not null check(trim(crop)<>''), stage text not null, area_ha numeric(14,4) not null check(area_ha>0),
  bag_kg numeric(8,3) not null default 60 check(bag_kg>0),
  forecast_sc_ha numeric(12,3) not null check(forecast_sc_ha>=0),
  price_per_bag numeric(14,4) not null check(price_per_bag>=0),
  budget_cost numeric(18,2) not null check(budget_cost>=0),
  foreign key(farm_id,season_id) references public.seasons(farm_id,id),
  foreign key(farm_id,plot_id) references public.plots(farm_id,id),
  unique(farm_id,season_id,plot_id), unique(farm_id,id), unique(farm_id,plot_id,id)
);
alter table public.transactions add column cycle_id uuid, add column cost_basis public.cost_basis,
  add check(cycle_id is null or (plot_id is not null and amount>0 and amount<'Infinity'::numeric and type is not null and type in ('income','expense'))),
  add foreign key(farm_id,plot_id,cycle_id) references public.crop_cycles(farm_id,plot_id,id);
create table public.inputs (
  id uuid primary key default gen_random_uuid(), farm_id uuid not null references public.farms,
  name text not null, family public.input_family not null, unit text not null check(unit in ('kg','L','un')),
  minimum numeric(16,4) not null default 0 check(minimum>=0),
  quantity numeric(16,4) not null default 0 check(quantity>=0),
  carrying_value numeric(22,8) not null default 0 check(carrying_value>=0),
  avg_cost numeric generated always as (carrying_value/nullif(quantity,0)) stored,
  unique(farm_id,name), unique(farm_id,id)
);
create table public.stage_history (
 id uuid primary key default gen_random_uuid(),farm_id uuid not null,cycle_id uuid not null,stage text not null,
 observed_at timestamptz not null default now(),recorded_by uuid default auth.uid() references public.profiles,
 foreign key(farm_id,cycle_id) references public.crop_cycles(farm_id,id)
);
create index stage_history_cycle on public.stage_history(cycle_id,observed_at);
create function agro_internal.log_stage() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or new.stage is distinct from old.stage then
   insert into public.stage_history(farm_id,cycle_id,stage) values(new.farm_id,new.id,new.stage);
 end if;
 return new;
end $$;
create trigger record_stage after insert or update of stage on public.crop_cycles for each row execute function agro_internal.log_stage();
create table public.input_lots (
  id uuid primary key default gen_random_uuid(), farm_id uuid not null, input_id uuid not null,
  code text not null, expires_on date, quantity numeric(16,4) not null default 0 check(quantity>=0),
  foreign key(farm_id,input_id) references public.inputs(farm_id,id), unique(farm_id,input_id,code),unique(farm_id,id)
);
create table public.machines (
  id uuid primary key default gen_random_uuid(),farm_id uuid not null references public.farms,
  name text not null, kind text not null, meter_unit public.meter_kind not null,
  meter numeric(14,2) not null default 0 check(meter>=0), hourly_rate numeric(14,4) not null check(hourly_rate>=0),
  unique(farm_id,id)
);
create table public.maintenance (
  id uuid primary key default gen_random_uuid(),farm_id uuid not null,machine_id uuid not null,
  kind text not null check(kind in ('preventive','corrective')), description text not null,
  due_on date, due_meter numeric(14,2) check(due_meter>=0), completed_on date,
  cost numeric(16,2) not null default 0 check(cost>=0),check(due_on is not null or due_meter is not null),
  foreign key(farm_id,machine_id) references public.machines(farm_id,id)
);
create table public.work_orders (
  id uuid primary key default gen_random_uuid(),farm_id uuid not null,cycle_id uuid not null,
  machine_id uuid not null, operator_id uuid not null, kind public.job_kind not null,
  planned_on date not null, area_ha numeric(14,4) not null check(area_ha>0),
  status public.job_state not null default 'planned', finished_at timestamptz,
  start_meter numeric(14,2), worked_hours numeric(12,2), machine_cost numeric(16,2), input_cost numeric(18,2),
  foreign key(farm_id,cycle_id) references public.crop_cycles(farm_id,id),
  foreign key(farm_id,machine_id) references public.machines(farm_id,id),
  foreign key(farm_id,operator_id) references public.farm_members(farm_id,user_id),unique(farm_id,id)
);
create table public.order_inputs (
  farm_id uuid not null,order_id uuid not null,lot_id uuid not null,dose_per_ha numeric(14,6) not null check(dose_per_ha>0),
  primary key(order_id,lot_id), foreign key(farm_id,order_id) references public.work_orders(farm_id,id),
  foreign key(farm_id,lot_id) references public.input_lots(farm_id,id)
);
create table public.stock_moves (
  id uuid primary key default gen_random_uuid(),farm_id uuid not null,lot_id uuid not null,
  event public.stock_event not null,qty numeric(16,4) not null check(qty>0),
  unit_cost numeric(20,8) not null check(unit_cost>=0), extended_cost numeric(22,8) not null check(extended_cost>=0),
  document text,order_id uuid,machine_id uuid,cycle_id uuid,meter_reading numeric(14,2),
  recorded_at timestamptz not null default now(),created_by uuid not null default auth.uid() references public.profiles,
  foreign key(farm_id,lot_id) references public.input_lots(farm_id,id),
  foreign key(farm_id,order_id) references public.work_orders(farm_id,id),
  foreign key(farm_id,machine_id) references public.machines(farm_id,id),
  foreign key(farm_id,cycle_id) references public.crop_cycles(farm_id,id),
  unique(order_id,lot_id),
  check(case event when 'receipt' then document is not null and trim(document)<>'' and order_id is null and machine_id is null and cycle_id is null
    when 'refuel' then machine_id is not null and meter_reading is not null and order_id is null
    else order_id is not null and cycle_id is not null and machine_id is null end)
);
create table public.destinations (
  id uuid primary key default gen_random_uuid(),farm_id uuid not null references public.farms,
  name text not null,kind public.storage_kind not null,unique(farm_id,id),unique(farm_id,name)
);
create table public.harvest_loads (
  id uuid primary key default gen_random_uuid(),farm_id uuid not null,cycle_id uuid not null,destination_id uuid not null,
  ticket text not null,received_on date not null, gross_kg numeric(16,3) not null,tare_kg numeric(16,3) not null,
  moisture_pct numeric(5,2) not null check(moisture_pct between 0 and 100),
  impurity_pct numeric(5,2) not null check(impurity_pct between 0 and 100),
  deduction_kg numeric(16,3) not null default 0 check(deduction_kg>=0),
  net_kg numeric generated always as (gross_kg-tare_kg-deduction_kg) stored,
  check(tare_kg>=0 and gross_kg>tare_kg+deduction_kg),unique(farm_id,destination_id,ticket),
  foreign key(farm_id,cycle_id) references public.crop_cycles(farm_id,id),
  foreign key(farm_id,destination_id) references public.destinations(farm_id,id)
);
create table public.bills (
  id uuid primary key default gen_random_uuid(),farm_id uuid not null references public.farms,cycle_id uuid,
  kind public.bill_kind not null,basis public.cost_basis not null,description text not null,
  amount numeric(18,2) not null check(amount>0),due_on date not null,settled_on date,
  transaction_id uuid unique references public.transactions, check((settled_on is null)=(transaction_id is null)),
  foreign key(farm_id,cycle_id) references public.crop_cycles(farm_id,id),
  check((kind='receivable' and basis in ('sale','other')) or (kind='payable' and basis<>'sale'))
);
create index jobs_cycle_day on public.work_orders(farm_id,cycle_id,planned_on);
create unique index jobs_one_running_machine on public.work_orders(machine_id) where status='running';
create unique index jobs_one_running_operator on public.work_orders(farm_id,operator_id) where status='running';
alter table public.stock_moves add unique(farm_id,id);
alter table public.harvest_loads add unique(farm_id,id);
alter table public.maintenance add unique(farm_id,id);
alter table public.bills
  add receipt_id uuid, add harvest_id uuid, add maintenance_id uuid,
  add foreign key(farm_id,receipt_id) references public.stock_moves(farm_id,id),
  add foreign key(farm_id,harvest_id) references public.harvest_loads(farm_id,id),
  add foreign key(farm_id,maintenance_id) references public.maintenance(farm_id,id),
  add check(num_nonnulls(receipt_id,harvest_id,maintenance_id)<=1),
  add check(receipt_id is null or (kind='payable' and basis='inventory')),
  add check(harvest_id is null or (kind='receivable' and basis='sale' and cycle_id is not null)),
  add check(maintenance_id is null or (kind='payable' and basis='equipment'));
create function agro_internal.bill_origin() returns trigger language plpgsql set search_path='' as $$
begin
 if new.receipt_id is not null and not exists(select from public.stock_moves where id=new.receipt_id and farm_id=new.farm_id and event='receipt') then
   raise exception 'Origem deve ser uma entrada de compra';
 end if;
 if new.harvest_id is not null and not exists(select from public.harvest_loads where id=new.harvest_id and farm_id=new.farm_id and cycle_id=new.cycle_id) then
   raise exception 'Romaneio pertence a outro ciclo';
 end if;
 return new;
end $$;
create trigger check_bill_origin before insert on public.bills for each row execute function agro_internal.bill_origin();
create index moves_lot_time on public.stock_moves(farm_id,lot_id,recorded_at);
create index moves_cycle on public.stock_moves(farm_id,cycle_id);
create index maintenance_open on public.maintenance(farm_id,machine_id) where completed_on is null;
create index bills_open on public.bills(farm_id,due_on) where settled_on is null;
create index harvest_cycle on public.harvest_loads(farm_id,cycle_id);
create index transactions_cycle on public.transactions(farm_id,cycle_id,transaction_date);
create index farm_members_user on public.farm_members(user_id,farm_id);

-- Helpers em schema fora da API. O usuário sempre vem do JWT.
create function agro_internal.member(f uuid, writing boolean default false) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.farm_members m where m.farm_id=f and m.user_id=(select auth.uid())
    and (not writing or m.role::text in ('owner','manager','editor')))
$$;
create function agro_internal.bootstrap(f uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.farms where id=f and created_by=(select auth.uid()))
   and not exists(select 1 from public.farm_members where farm_id=f)
$$;
create function agro_internal.peer(u uuid) returns boolean language sql stable security definer set search_path='' as $$
 select u=(select auth.uid()) or exists(select 1 from public.farm_members a join public.farm_members b using(farm_id)
   where a.user_id=(select auth.uid()) and b.user_id=u)
$$;
create function agro_internal.unclaimed(f uuid) returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from public.farm_members where farm_id=f)
$$;
create function agro_internal.require_writer(f uuid) returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not agro_internal.member(f,true) then raise exception 'Sem permissão de escrita' using errcode='42501'; end if;
end $$;
create function agro_internal.apply_move() returns trigger language plpgsql set search_path='' as $$
declare lot public.input_lots; item public.inputs; machine public.machines;
begin
 select * into strict lot from public.input_lots where farm_id=new.farm_id and id=new.lot_id for update;
 select * into strict item from public.inputs where farm_id=lot.farm_id and id=lot.input_id for update;
 if new.qty<=0 then raise exception 'Quantidade deve ser positiva'; end if;
 if new.event='receipt' then
   new.extended_cost:=round(new.qty*new.unit_cost,8);
   update public.inputs set quantity=quantity+new.qty,carrying_value=carrying_value+new.extended_cost where id=item.id;
   update public.input_lots set quantity=quantity+new.qty where id=lot.id;
 else
   if lot.quantity<new.qty or item.quantity<new.qty then raise exception 'Saldo insuficiente no lote %',lot.code; end if;
   if lot.expires_on<current_date then raise exception 'Lote vencido: %',lot.code; end if;
   if new.event='refuel' then
     select * into strict machine from public.machines where id=new.machine_id and farm_id=new.farm_id for update;
     if item.family<>'fuel' or item.unit<>'L' or new.meter_reading<machine.meter then raise exception 'Combustível ou leitura incompatível'; end if;
     update public.machines set meter=new.meter_reading where id=machine.id;
   end if;
   new.unit_cost:=item.avg_cost;
   new.extended_cost:=round(item.carrying_value*new.qty/item.quantity,8);
   update public.inputs set quantity=quantity-new.qty,carrying_value=carrying_value-new.extended_cost where id=item.id;
   update public.input_lots set quantity=quantity-new.qty where id=lot.id;
 end if;
 return new;
end $$;
create trigger stock_apply before insert on public.stock_moves for each row execute function agro_internal.apply_move();

create function public.receive_stock(p_request uuid,p_farm uuid,p_lot uuid,p_qty numeric,p_unit_cost numeric,p_document text)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 perform agro_internal.require_writer(p_farm);
 insert into public.stock_moves(id,farm_id,lot_id,event,qty,unit_cost,document)
 values(p_request,p_farm,p_lot,'receipt',p_qty,p_unit_cost,p_document);
 return p_request;
end $$;
create function public.refuel_machine(p_request uuid,p_farm uuid,p_lot uuid,p_qty numeric,p_machine uuid,p_meter numeric,p_cycle uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 perform agro_internal.require_writer(p_farm);
 insert into public.stock_moves(id,farm_id,lot_id,event,qty,machine_id,meter_reading,cycle_id)
 values(p_request,p_farm,p_lot,'refuel',p_qty,p_machine,p_meter,p_cycle);
 return p_request;
end $$;
create function agro_internal.plan_line() returns trigger language plpgsql security definer set search_path='' as $$
declare parent uuid; parent_state public.job_state;
begin
 parent:=case when tg_op='DELETE' then old.order_id else new.order_id end;
 select status into strict parent_state from public.work_orders where id=parent for update;
 if parent_state<>'planned' then raise exception 'Insumos só podem mudar no planejamento'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
create trigger guard_order_line before insert or update or delete on public.order_inputs for each row execute function agro_internal.plan_line();
create function agro_internal.job_area() returns trigger language plpgsql set search_path='' as $$
begin
 if new.area_ha>(select area_ha from public.crop_cycles where id=new.cycle_id and farm_id=new.farm_id)
 then raise exception 'Área da OS excede a área do ciclo'; end if;
 return new;
end $$;
create trigger guard_job_area before insert on public.work_orders for each row execute function agro_internal.job_area();

create function public.advance_order(p_farm uuid,p_order uuid,p_status public.job_state,p_hours numeric default null,p_end_meter numeric default null)
returns void language plpgsql security definer set search_path='' as $$
declare job public.work_orders; machine public.machines; material numeric; line record;
begin
 perform agro_internal.require_writer(p_farm);
 select * into strict job from public.work_orders where id=p_order and farm_id=p_farm for update;
 if job.status=p_status then return; end if;
 if p_status in ('running','cancelled') and (job.status='planned' or (job.status='running' and p_status='cancelled')) then
   if p_status='running' then
     select * into strict machine from public.machines where id=job.machine_id and farm_id=p_farm for update;
     update public.work_orders set status=p_status,start_meter=machine.meter where id=p_order;
   else
     update public.work_orders set status=p_status where id=p_order;
   end if;
   return;
 end if;
 p_hours:=round(p_hours,2);
 if job.status<>'running' or p_status is distinct from 'completed' or p_hours is null or p_hours<=0 then
   raise exception 'Transição de OS ou horas inválidas';
 end if;
 for line in select lot_id,dose_per_ha from public.order_inputs where order_id=p_order order by lot_id loop
   insert into public.stock_moves(farm_id,lot_id,event,qty,order_id,cycle_id)
   values(p_farm,line.lot_id,'work_order',round(line.dose_per_ha*job.area_ha,4),p_order,job.cycle_id);
 end loop;
 select * into strict machine from public.machines where id=job.machine_id and farm_id=p_farm for update;
 if machine.meter_unit='km' and (p_end_meter is null or p_end_meter<machine.meter) then raise exception 'Informe odômetro final válido'; end if;
 update public.machines set meter=case when meter_unit='hours' then greatest(meter,job.start_meter+p_hours) else p_end_meter end where id=machine.id;
 select coalesce(sum(extended_cost),0) into material from public.stock_moves where order_id=p_order;
 update public.work_orders set status='completed',finished_at=now(),worked_hours=p_hours,
   input_cost=material,machine_cost=round(machine.hourly_rate*p_hours,2) where id=p_order;
end $$;
create function public.settle_bill(p_farm uuid,p_bill uuid,p_date date) returns uuid
language plpgsql security definer set search_path='' as $$
declare bill public.bills; plot uuid; movement uuid;
begin
 perform agro_internal.require_writer(p_farm);
 select * into strict bill from public.bills where farm_id=p_farm and id=p_bill for update;
 if bill.transaction_id is not null then return bill.transaction_id; end if;
 if p_date is null or p_date>current_date then raise exception 'Data de liquidação inválida'; end if;
 select plot_id into plot from public.crop_cycles where id=bill.cycle_id;
 insert into public.transactions(farm_id,plot_id,cycle_id,amount,category,description,transaction_date,created_by,type,cost_basis)
 values(p_farm,plot,bill.cycle_id,bill.amount,bill.basis::text,bill.description,p_date,auth.uid(),
   case when bill.kind='payable' then 'expense' else 'income' end,bill.basis) returning id into movement;
 update public.bills set settled_on=p_date,transaction_id=movement where id=p_bill;
 return movement;
end $$;
create function agro_internal.protect_cash() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.bills where transaction_id=old.id) then raise exception 'Liquidação vinculada a título é imutável'; end if;
 if tg_op='DELETE' then return old; end if;
 if new.farm_id<>old.farm_id or new.created_by<>old.created_by then raise exception 'Origem imutável'; end if;
 return new;
end $$;
create trigger guarded_cash before update or delete on public.transactions for each row execute function agro_internal.protect_cash();

-- Visões sempre usam RLS e permissões do solicitante. Agregações separadas evitam fan-out.
create view public.cycle_economics with (security_invoker=true) as
select c.farm_id,c.season_id,c.plot_id,c.id as cycle_id,c.area_ha,
 h.kg as harvested_kg,h.kg/c.bag_kg/c.area_ha as actual_sc_ha,
 k.cost as actual_cost,k.cost/c.area_ha as cost_per_ha,
 c.forecast_sc_ha*c.area_ha*c.price_per_bag-c.budget_cost as projected_margin,
 f.revenue-k.cost as realized_margin,f.revenue as received_revenue
from public.crop_cycles c
cross join lateral(select coalesce(sum(net_kg),0) kg from public.harvest_loads where cycle_id=c.id) h
cross join lateral(select coalesce(sum(input_cost+machine_cost),0) cost from public.work_orders where cycle_id=c.id and status='completed') j
cross join lateral(select coalesce(sum(extended_cost),0) cost from public.stock_moves where cycle_id=c.id and event='refuel') d
cross join lateral(select coalesce(sum(amount) filter(where type='income' and cost_basis='sale'),0) revenue,
 coalesce(sum(amount) filter(where type='expense' and cost_basis='direct'),0) cost from public.transactions where cycle_id=c.id) f
cross join lateral(select j.cost+d.cost+f.cost cost) k;
create view public.farm_alerts with(security_invoker=true) as
select farm_id,'stock'::text as kind,id as source_id,name as label,null::date as due_on from public.inputs where quantity<=minimum
union all select m.farm_id,'maintenance',m.id,m.description,m.due_on from public.maintenance m join public.machines a on a.id=m.machine_id
where m.completed_on is null and (m.due_on<=current_date or m.due_meter<=a.meter)
union all select farm_id,'bill',id,description,due_on from public.bills where settled_on is null and due_on<=current_date+7;

create view public.lot_demand with(security_invoker=true) as
select l.farm_id,l.id as lot_id,l.input_id,min(j.planned_on) as first_operation,
 sum(round(d.dose_per_ha*j.area_ha,4)) as required_qty,l.quantity as available_qty,
 greatest(sum(round(d.dose_per_ha*j.area_ha,4))-l.quantity,0) as shortage_qty
from public.order_inputs d join public.work_orders j on j.id=d.order_id
join public.input_lots l on l.id=d.lot_id
where j.status in ('planned','running') and j.planned_on<=current_date+7
group by l.id;

alter table public.field_operations add column order_id uuid,
 add foreign key(farm_id,order_id) references public.work_orders(farm_id,id);
create table public.grain_dispatches (
 id uuid primary key default gen_random_uuid(),farm_id uuid not null,cycle_id uuid not null,destination_id uuid not null,
 document text not null,shipped_on date not null,kg numeric(16,3) not null check(kg>0),recipient text not null,
 foreign key(farm_id,cycle_id) references public.crop_cycles(farm_id,id),
 foreign key(farm_id,destination_id) references public.destinations(farm_id,id),unique(farm_id,destination_id,document)
);
create view public.grain_balances with(security_invoker=true) as
select farm_id,destination_id,cycle_id,sum(delta_kg) as kg from (
 select farm_id,destination_id,cycle_id,net_kg as delta_kg from public.harvest_loads
 union all select farm_id,destination_id,cycle_id,-kg from public.grain_dispatches
) moves group by farm_id,destination_id,cycle_id;
create function agro_internal.guard_dispatch() returns trigger language plpgsql security definer set search_path='' as $$
declare balance numeric;
begin
 perform 1 from public.destinations where id=new.destination_id and farm_id=new.farm_id for update;
 select kg into balance from public.grain_balances where farm_id=new.farm_id and destination_id=new.destination_id and cycle_id=new.cycle_id;
 if coalesce(balance,0)<new.kg then raise exception 'Saldo de grãos insuficiente'; end if;
 return new;
end $$;
create trigger check_dispatch before insert on public.grain_dispatches for each row execute function agro_internal.guard_dispatch();

-- Combina GRANT mínimo, políticas permissivas e limites restritivos para as tabelas legadas.
-- Apenas a migração de uma base validada deve alterar privilégios existentes.
do $$
declare t text; cmd text; cond text; uid text:='(select auth.uid())'; read_rule text; write_rule text; cols text;
begin
 foreach t in array array['profiles','farms','farm_members','plots','transactions','field_operations','seasons','crop_cycles','stage_history','inputs','input_lots','machines','maintenance','work_orders','order_inputs','stock_moves','destinations','harvest_loads','grain_dispatches','bills'] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('revoke all on public.%I from public, anon, authenticated',t);
   select string_agg(quote_ident(column_name),',') into cols from information_schema.columns
     where table_schema='public' and table_name=t;
   execute format('revoke all (%s) on public.%I from public, anon, authenticated',cols,t);
   execute format('grant select on public.%I to authenticated',t);
   read_rule:=case t when 'profiles' then 'agro_internal.peer(id)'
     when 'farms' then '(agro_internal.member(id) or (created_by=auth.uid() and agro_internal.unclaimed(id)))'
     else 'agro_internal.member(farm_id)' end;
   write_rule:=case t when 'profiles' then 'id='||uid when 'farms' then 'agro_internal.member(id,true)'
     when 'farm_members' then 'false' else 'agro_internal.member(farm_id,true)' end;
   foreach cmd in array array['select','insert','update','delete'] loop
     cond:=case when cmd='select' then read_rule else write_rule end;
     if cmd='insert' and t='farms' then cond:='created_by='||uid; end if;
     if cmd='insert' and t='farm_members' then cond:='user_id='||uid||' and role::text=''owner'' and agro_internal.bootstrap(farm_id)';end if;
     if cmd='insert' and t='transactions' then cond:=cond||' and created_by='||uid;end if;
     if t in ('stock_moves','field_operations') and cmd<>'select' then cond:='false'; end if;
     execute format('create policy %I on public.%I as restrictive for %s to authenticated %s (%s)',
       'erp_limit_'||cmd,t,cmd,case when cmd='insert' then 'with check' else 'using' end,cond);
     execute format('create policy %I on public.%I for %s to authenticated %s (%s)',
       'erp_access_'||cmd,t,cmd,case when cmd='insert' then 'with check' else 'using' end,cond);
   end loop;
 end loop;
end $$;
grant insert(id,full_name),update(full_name) on public.profiles to authenticated;
grant insert(name,latitude,longitude,created_by),update(name,latitude,longitude),delete on public.farms to authenticated;
grant insert(farm_id,user_id,role) on public.farm_members to authenticated;
grant insert(farm_id,name,coordinates),update(name,coordinates),delete on public.plots to authenticated;
grant insert(farm_id,plot_id,amount,category,description,transaction_date,created_by,type,cycle_id,cost_basis),
 update(farm_id,plot_id,amount,category,description,transaction_date,type,cycle_id,cost_basis),delete on public.transactions to authenticated;
grant insert(farm_id,name,starts_on,ends_on,active),update(active,name,ends_on) on public.seasons to authenticated;
grant insert(farm_id,season_id,plot_id,crop,stage,area_ha,bag_kg,forecast_sc_ha,price_per_bag,budget_cost),
 update(stage,forecast_sc_ha,price_per_bag,budget_cost) on public.crop_cycles to authenticated;
grant insert(farm_id,name,family,unit,minimum),update(name,minimum) on public.inputs to authenticated;
grant insert(farm_id,input_id,code,expires_on) on public.input_lots to authenticated;
grant insert(farm_id,name,kind,meter_unit,meter,hourly_rate),update(name,hourly_rate) on public.machines to authenticated;
grant insert(farm_id,machine_id,kind,description,due_on,due_meter,cost,completed_on),update(completed_on,cost,description,due_on,due_meter) on public.maintenance to authenticated;
grant insert(farm_id,cycle_id,machine_id,operator_id,kind,planned_on,area_ha) on public.work_orders to authenticated;
grant insert(farm_id,order_id,lot_id,dose_per_ha),update(dose_per_ha),delete on public.order_inputs to authenticated;
grant insert(farm_id,name,kind),update(name) on public.destinations to authenticated;
grant insert(farm_id,cycle_id,destination_id,ticket,received_on,gross_kg,tare_kg,moisture_pct,impurity_pct,deduction_kg) on public.harvest_loads to authenticated;
grant insert(farm_id,cycle_id,destination_id,document,shipped_on,kg,recipient) on public.grain_dispatches to authenticated;
grant insert(farm_id,cycle_id,kind,basis,description,amount,due_on,receipt_id,harvest_id,maintenance_id) on public.bills to authenticated;
revoke all on public.farm_alerts,public.cycle_economics,public.grain_balances,public.lot_demand from public,anon,authenticated;
grant select on public.farm_alerts,public.cycle_economics,public.grain_balances,public.lot_demand to authenticated;
revoke all on all functions in schema agro_internal from public,anon,authenticated;
grant usage on schema agro_internal to authenticated;
grant execute on function agro_internal.unclaimed(uuid) to authenticated;
grant execute on function agro_internal.member(uuid,boolean),agro_internal.peer(uuid),agro_internal.bootstrap(uuid) to authenticated;
revoke all on function public.receive_stock(uuid,uuid,uuid,numeric,numeric,text),
 public.refuel_machine(uuid,uuid,uuid,numeric,uuid,numeric,uuid),public.advance_order(uuid,uuid,public.job_state,numeric,numeric),
 public.settle_bill(uuid,uuid,date) from public,anon,authenticated;
grant execute on function public.receive_stock(uuid,uuid,uuid,numeric,numeric,text),
 public.refuel_machine(uuid,uuid,uuid,numeric,uuid,numeric,uuid),public.advance_order(uuid,uuid,public.job_state,numeric,numeric),
 public.settle_bill(uuid,uuid,date) to authenticated;

-- numeric aceita NaN no PostgreSQL mesmo com CHECK > 0. Nenhuma medida do ERP admite NaN.
do $$
declare c record;
begin
 for c in select table_name,column_name from information_schema.columns
   where table_schema='public' and data_type='numeric' and table_name in
   ('seasons','crop_cycles','inputs','input_lots','stock_moves','machines','maintenance','work_orders','order_inputs','harvest_loads','grain_dispatches','bills')
 loop
   execute format('alter table public.%I add check (%I <> ''NaN''::numeric)',c.table_name,c.column_name);
 end loop;
end $$;
commit;
