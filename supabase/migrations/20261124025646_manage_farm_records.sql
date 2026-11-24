begin;
-- Snapshot of the physical reading just before a posting, including concurrent refuels.
alter table public.stock_moves add column prior_meter numeric;
alter table public.work_orders add column prior_finish_meter numeric;
create or replace function public.advance_order(p_farm uuid,p_order uuid,p_status public.job_state,p_hours numeric default null,p_end_meter numeric default null)
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
 update public.work_orders set prior_finish_meter=machine.meter,status='completed',finished_at=clock_timestamp(),worked_hours=p_hours,
   input_cost=material,machine_cost=round(machine.hourly_rate*p_hours,2) where id=p_order;
end $$;
create function agro_internal.capture_refuel_meter() returns trigger language plpgsql set search_path='' as $$
begin
  if new.event='refuel' then
    select meter into new.prior_meter from public.machines where id=new.machine_id and farm_id=new.farm_id for update;
  end if;
  return new;
end $$;
create trigger stock_00_meter before insert on public.stock_moves for each row execute function agro_internal.capture_refuel_meter();
create function agro_internal.date_material_posting() returns trigger language plpgsql set search_path='' as $$
begin
  if new.recorded_at=transaction_timestamp() then new.recorded_at:=clock_timestamp(); end if;
  return new;
end $$;
create trigger stock_z_posting_time before insert on public.stock_moves for each row execute function agro_internal.date_material_posting();

create function agro_internal.undo_material(m public.stock_moves) returns void
language plpgsql set search_path='' as $$
declare item uuid; direction integer;
begin
  select input_id into strict item from public.input_lots where id=m.lot_id and farm_id=m.farm_id for update;
  perform 1 from public.inputs where id=item for update;
  if exists(select from public.stock_moves later join public.input_lots l on l.id=later.lot_id
    where l.input_id=item and later.id<>m.id and later.recorded_at>=m.recorded_at
    and not (m.order_id is not null and later.order_id is not distinct from m.order_id)) then
    raise exception 'Corrija primeiro as movimentações posteriores deste insumo para preservar o custo médio.';
  end if;
  direction:=case when m.event='receipt' then -1 else 1 end;
  update public.inputs set quantity=quantity+direction*m.qty,carrying_value=carrying_value+direction*m.extended_cost where id=item;
  update public.input_lots set quantity=quantity+direction*m.qty where id=m.lot_id;
  delete from public.stock_moves where id=m.id;
end $$;
revoke all on function agro_internal.undo_material(public.stock_moves) from public,anon,authenticated;

create function public.manage_farm_record(p_farm uuid,p_table text,p_key uuid,p_expected jsonb,p_action text,p_changes jsonb default '{}')
returns void language plpgsql security definer set search_path='' as $$
declare allowed text[]; original jsonb; edits text; lookup text:='id=$2'; field text;
  move public.stock_moves; cash uuid; parent uuid; latest text; previous_meter numeric;
begin
  perform agro_internal.require_writer(p_farm);
  allowed:=case p_table
    when 'inputs' then array['name','minimum']
    when 'input_lots' then array['code','expires_on']
    when 'machines' then array['name','kind','hourly_rate']
    when 'maintenance' then array['description','cost','due_on','due_meter','completed_on']
    when 'seasons' then array['name','starts_on','ends_on']
    when 'crop_cycles' then array['crop','bag_kg','price_per_bag','forecast_sc_ha','budget_cost']
    when 'stage_history' then array['stage']
    when 'destinations' then array['name','kind']
    when 'harvest_loads' then array['ticket','received_on','gross_kg','tare_kg','deduction_kg','moisture_pct','impurity_pct']
    when 'grain_dispatches' then array['document','shipped_on','kg','recipient']
    when 'work_orders' then array['planned_on','area_ha','kind']
    when 'order_inputs' then array['dose_per_ha']
    when 'bills' then array['description','amount','due_on','category']
    when 'stock_moves' then array['document','qty','unit_cost']
  end;
  if allowed is null or p_action is null or p_action not in ('update','delete','reopen') then raise exception 'Operação inválida'; end if;
  if p_table='order_inputs' then lookup:='order_id=$2 and lot_id=($3->>''lot_id'')::uuid'; end if;
  execute format('select to_jsonb(r) from public.%I r where farm_id=$1 and %s for update',p_table,lookup)
    into original using p_farm,p_key,p_expected;
  if original is null or original is distinct from p_expected then raise exception 'Registro alterado. Atualize a lista antes de continuar.'; end if;
  if p_changes is null or jsonb_typeof(p_changes)<>'object' or exists(select from jsonb_object_keys(p_changes) k where not(k=any(allowed))) then raise exception 'Campos inválidos'; end if;
  if p_table='bills' and original->>'transaction_id' is not null then
    if p_action<>'reopen' then raise exception 'Reabra o título antes de alterá-lo.'; end if;
    cash:=(original->>'transaction_id')::uuid;
    update public.bills set settled_on=null,transaction_id=null where id=p_key;
    delete from public.transactions where id=cash and farm_id=p_farm;
    return;
  end if;
  if p_table='work_orders' and original->>'status'<>'planned' then
    if p_action<>'reopen' then raise exception 'Retorne a OS ao planejamento antes de alterá-la.'; end if;
    if original->>'status'='completed' then
      perform 1 from public.machines where id=(original->>'machine_id')::uuid for update;
      if exists(select from public.work_orders where machine_id=(original->>'machine_id')::uuid and id<>p_key
        and (status='running' or finished_at >= (original->>'finished_at')::timestamptz)) or
        exists(select from public.stock_moves where machine_id=(original->>'machine_id')::uuid and recorded_at >= (original->>'finished_at')::timestamptz) then
        raise exception 'Revise primeiro as operações e abastecimentos posteriores da máquina.';
      end if;
      previous_meter:=coalesce((original->>'prior_finish_meter')::numeric,
        greatest((original->>'start_meter')::numeric,(select max(meter_reading) from public.stock_moves
        where machine_id=(original->>'machine_id')::uuid and recorded_at<(original->>'finished_at')::timestamptz)));
      update public.machines set meter=previous_meter where id=(original->>'machine_id')::uuid;
    end if;
    for move in select * from public.stock_moves where order_id=p_key and farm_id=p_farm order by lot_id for update loop
      perform agro_internal.undo_material(move);
    end loop;
    update public.work_orders set status='planned',finished_at=null,start_meter=null,prior_finish_meter=null,worked_hours=null,machine_cost=null,input_cost=null where id=p_key;
    return;
  end if;
  if p_action='reopen' then raise exception 'Registro já aberto'; end if;
  if p_table='stock_moves' then
    select * into strict move from public.stock_moves where id=p_key;
    if move.event='work_order' then raise exception 'Corrija a baixa reabrindo a ordem de serviço.'; end if;
    if move.event='refuel' and (p_changes ? 'unit_cost' or p_changes ? 'document') then raise exception 'O custo do abastecimento é calculado pelo estoque'; end if;
    if move.event='refuel' then
      perform 1 from public.machines where id=move.machine_id for update;
      if exists(select from public.stock_moves where machine_id=move.machine_id and id<>move.id and recorded_at>=move.recorded_at)
        or exists(select from public.work_orders where machine_id=move.machine_id and (status='running' or finished_at>move.recorded_at)) then
        raise exception 'Revise primeiro os registros posteriores da máquina.';
      end if;
      if move.prior_meter is not null then update public.machines set meter=move.prior_meter where id=move.machine_id; end if;
    end if;
    perform agro_internal.undo_material(move);
    if p_action='update' then
      insert into public.stock_moves(id,farm_id,event,lot_id,qty,unit_cost,document,machine_id,meter_reading,cycle_id,recorded_at,created_by)
      values(move.id,p_farm,move.event,move.lot_id,coalesce((p_changes->>'qty')::numeric,move.qty),
        coalesce((p_changes->>'unit_cost')::numeric,move.unit_cost),coalesce(p_changes->>'document',move.document),
        move.machine_id,move.meter_reading,move.cycle_id,move.recorded_at,move.created_by);
      if move.event='refuel' then update public.stock_moves set prior_meter=move.prior_meter where id=move.id; end if;
    end if;
    return;
  end if;
  if p_table in ('harvest_loads','grain_dispatches') then
    perform 1 from public.destinations where id=(original->>'destination_id')::uuid for update;
  end if;
  if p_table='work_orders' and p_changes ? 'area_ha' and (p_changes->>'area_ha')::numeric >
    (select area_ha from public.crop_cycles where id=(original->>'cycle_id')::uuid) then raise exception 'Área superior à do ciclo'; end if;
  if p_table='stage_history' then
    parent:=(original->>'cycle_id')::uuid;
    perform 1 from public.crop_cycles where id=parent for update;
  end if;
  if p_action='delete' then
    if p_table='crop_cycles' then delete from public.stage_history where cycle_id=p_key; end if;
    if p_table='work_orders' then delete from public.order_inputs where order_id=p_key; end if;
    execute format('delete from public.%I where farm_id=$1 and %s',p_table,lookup) using p_farm,p_key,p_expected;
  else
    for field in select jsonb_object_keys(p_changes) loop
      if jsonb_typeof(p_changes->field)='string' and btrim(p_changes->>field)='' then raise exception 'Preencha o campo obrigatório'; end if;
    end loop;
    select string_agg(format('%1$I = v.%1$I',k),', ') into edits from jsonb_object_keys(p_changes) k;
    if edits is null then return; end if;
    execute format('update public.%1$I r set %2$s from jsonb_populate_record(null::public.%1$I,$4) v where r.farm_id=$1 and r.%3$s',p_table,edits,replace(lookup,'and lot_id','and r.lot_id'))
      using p_farm,p_key,p_expected,p_changes;
  end if;
  if p_table in ('harvest_loads','grain_dispatches') and exists(select from public.grain_balances
    where farm_id=p_farm and destination_id=(original->>'destination_id')::uuid and cycle_id=(original->>'cycle_id')::uuid and kg<0) then
    raise exception 'A correção deixaria o saldo de grãos negativo. Revise as expedições.'; end if;
  if p_table='stage_history' then
    select stage into latest from public.stage_history where cycle_id=parent order by observed_at desc,id desc limit 1;
    if latest is null then raise exception 'O ciclo precisa de um estágio. Edite o registro existente.'; end if;
    update public.crop_cycles set stage=latest where id=parent and stage is distinct from latest;
  end if;
exception when foreign_key_violation then raise exception 'Há registros vinculados. Revise os vínculos antes de continuar.';
end $$;
-- Synchronizing a corrected history must not append a duplicate observation.
create or replace function agro_internal.log_stage() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or (new.stage is distinct from old.stage and new.stage is distinct from
   (select stage from public.stage_history where cycle_id=new.id order by observed_at desc,id desc limit 1)) then
   insert into public.stage_history(farm_id,cycle_id,stage) values(new.farm_id,new.id,new.stage);
 end if;
 return new;
end $$;
revoke all on function public.manage_farm_record(uuid,text,uuid,jsonb,text,jsonb) from public,anon;
grant execute on function public.manage_farm_record(uuid,text,uuid,jsonb,text,jsonb) to authenticated;
commit;
