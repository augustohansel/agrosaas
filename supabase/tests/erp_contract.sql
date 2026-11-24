-- Somente em banco de testes com as duas migrations aplicadas.
-- IDs novos por execução. Tudo é desfeito no final.
\set ON_ERROR_STOP on
begin;
select gen_random_uuid() owner_id,gen_random_uuid() viewer_id,gen_random_uuid() outsider_id,gen_random_uuid() farm_id,gen_random_uuid() other_id \gset
insert into auth.users(id) values (:'owner_id'),(:'viewer_id'),(:'outsider_id');
insert into public.profiles(id) values (:'owner_id'),(:'viewer_id'),(:'outsider_id') on conflict(id) do nothing;
select set_config('request.jwt.claim.sub',:'owner_id',true);
set local role authenticated;
insert into public.farms(name) values ('Fazenda teste') returning id as fid \gset
insert into public.farm_members values(:'fid',:'owner_id','owner');
reset role;
insert into public.farm_members values(:'fid',:'viewer_id','viewer');
insert into public.farms(id,name,created_by) values(:'other_id','Outra',:'outsider_id');
insert into public.farm_members values(:'other_id',:'outsider_id','owner');
insert into public.plots(farm_id,name,coordinates) values(:'other_id','Externo','[]') returning id as foreign_plot \gset
set local role authenticated;
insert into public.plots(farm_id,name,coordinates) values(:'fid','Várzea','[]') returning id as pid \gset
update public.plots set color='#24a5a2' where id=:'pid';
insert into public.map_preferences(base_map) values('street')
 on conflict(user_id) do update set base_map=excluded.base_map;
insert into public.map_preferences(map_layer) values(2)
 on conflict(user_id) do update set map_layer=excluded.map_layer;
do $$ begin
 if not exists(select from public.map_preferences where base_map='street' and map_layer=2)
 then raise exception 'Preferências do mapa divergentes'; end if;
end $$;
insert into public.seasons(farm_id,name,starts_on,ends_on,active) values(:'fid','2026/27',current_date,current_date+150,true) returning id as sid \gset
insert into public.crop_cycles(farm_id,season_id,plot_id,crop,stage,area_ha,forecast_sc_ha,price_per_bag,budget_cost)
 values(:'fid',:'sid',:'pid','Soja','V2',10,60,120,36000) returning id as cid \gset
insert into public.inputs(farm_id,name,family,unit) values(:'fid','Semente','seed','kg') returning id as iid \gset
insert into public.input_lots(farm_id,input_id,code) values(:'fid',:'iid','L1') returning id as lot \gset
insert into public.input_lots(farm_id,input_id,code) values(:'fid',:'iid','L2') returning id as empty_lot \gset
select public.receive_stock(gen_random_uuid(),:'fid',:'lot',10,4,'NF1');
select public.receive_stock(gen_random_uuid(),:'fid',:'lot',10,6,'NF2');
insert into public.machines(farm_id,name,kind,meter_unit,hourly_rate) values(:'fid','T-01','tratores','hours',100) returning id as mid \gset
insert into public.work_orders(farm_id,cycle_id,machine_id,operator_id,kind,planned_on,area_ha)
 values(:'fid',:'cid',:'mid',:'owner_id','planting',current_date,10) returning id as job \gset
insert into public.order_inputs values(:'fid',:'job',:'lot',1),(:'fid',:'job',:'empty_lot',1);
select public.advance_order(:'fid',:'job','running');
select set_config('test.farm',:'fid',true),set_config('test.job',:'job',true),set_config('test.other_plot',:'foreign_plot',true),set_config('test.user',:'owner_id',true);
do $$ begin
 begin
   perform public.advance_order(current_setting('test.farm')::uuid,current_setting('test.job')::uuid,'completed',2);
   raise exception 'Baixa indevida' using errcode='XX000';
 exception when raise_exception then if sqlerrm not like 'Saldo insuficiente%' then raise; end if; end;
 if exists(select from public.stock_moves where event='work_order') then raise exception 'Baixa parcial'; end if;
 begin
   insert into public.transactions(farm_id,plot_id,amount,category,type,transaction_date,created_by)
   values(current_setting('test.farm')::uuid,current_setting('test.other_plot')::uuid,1,'Teste','expense',current_date,current_setting('test.user')::uuid);
   raise exception 'FK entre fazendas ausente';
 exception when foreign_key_violation then null; end;
end $$;
select public.receive_stock(gen_random_uuid(),:'fid',:'empty_lot',10,5,'NF3');
select public.advance_order(:'fid',:'job','completed',2);
select public.advance_order(:'fid',:'job','completed',2);
insert into public.destinations(farm_id,name,kind) values(:'fid','Silo A','silo') returning id as dest \gset
insert into public.harvest_loads(farm_id,cycle_id,destination_id,ticket,received_on,gross_kg,tare_kg,moisture_pct,impurity_pct,deduction_kg)
 values(:'fid',:'cid',:'dest','R1',current_date,17000,4800,14,1,200);
insert into public.grain_dispatches(farm_id,cycle_id,destination_id,document,shipped_on,kg,recipient)
 values(:'fid',:'cid',:'dest','S1',current_date,1000,'Cooperativa');
insert into public.bills(farm_id,cycle_id,kind,basis,category,description,amount,due_on)
 values(:'fid',:'cid','receivable','sale','Venda de Soja','Venda',45000,current_date) returning id as bill \gset
select public.settle_bill(:'fid',:'bill',current_date);
select public.settle_bill(:'fid',:'bill',current_date);
do $$ begin
 if (select count(*) from public.stock_moves where event='work_order')<>2 or
    not exists(select from public.transactions where cost_basis='sale' and category='Venda de Soja') or
    (select quantity from public.inputs)<>10 or (select avg_cost from public.inputs)<>5 or
    (select count(*) from public.transactions)<>1 or (select count(*) from public.stage_history)<>1 or
    (select kg from public.grain_balances)<>11000 or not exists(select from public.cycle_economics where
    actual_cost=300 and harvested_kg=12000 and actual_sc_ha=20 and realized_margin=44700)
 then raise exception 'Reconciliação falhou'; end if;
end $$;
insert into public.inputs(farm_id,name,family,unit) values(:'fid','Diesel S10','fuel','L') returning id as fuel \gset
insert into public.input_lots(farm_id,input_id,code) values(:'fid',:'fuel','Diesel A') returning id as tank \gset
select public.receive_stock(gen_random_uuid(),:'fid',:'tank',100,6,'NF diesel');
select public.refuel_machine(gen_random_uuid(),:'fid',:'tank',20,:'mid',3,:'cid');
insert into public.maintenance(farm_id,machine_id,kind,description,due_meter,cost)
 values(:'fid',:'mid','preventive','Revisão do trator',3,80) returning id as maintenance_id \gset
do $$ begin
 if not exists(select from public.farm_alerts where kind='maintenance' and label='Revisão do trator')
 then raise exception 'Revisão atingiu o contador sem gerar alerta'; end if;
end $$;
update public.maintenance set completed_on=current_date where id=:'maintenance_id';
insert into public.bills(farm_id,cycle_id,kind,basis,maintenance_id,description,amount,due_on)
 values(:'fid',:'cid','payable','equipment',:'maintenance_id','Revisão do trator',80,current_date)
 returning id as maintenance_bill \gset
select public.settle_bill(:'fid',:'maintenance_bill',current_date);
do $$ begin
 if exists(select from public.farm_alerts where kind in ('bill','maintenance')) or
    not exists(select from public.transactions where type='expense' and cost_basis='equipment' and amount=80) or
    not exists(select from public.cycle_economics where realized_margin=44580)
 then raise exception 'Manutenção, caixa ou margem divergente'; end if;
 if not exists(select from public.inputs where name='Diesel S10' and quantity=80 and carrying_value=480) or
 not exists(select from public.cycle_economics where actual_cost=420 and cost_per_ha=42) or
 not exists(select from public.machines where meter=3) then raise exception 'Abastecimento não reconciliado';end if;
end $$;
savepoint manager_checks;
do $$ declare r public.harvest_loads; begin
 select * into strict r from public.harvest_loads;
 begin
   perform public.manage_farm_record(r.farm_id,'harvest_loads',r.id,to_jsonb(r),'delete');
   raise exception 'Romaneio expedido foi excluído';
 exception when raise_exception then
   if sqlerrm not like 'A correção deixaria%' then raise; end if;
 end;
end $$;
select public.manage_farm_record(farm_id,'bills',id,to_jsonb(b),'reopen') from public.bills b where id=:'bill';
select public.manage_farm_record(farm_id,'bills',id,to_jsonb(b),'update','{"amount":125}'::jsonb) from public.bills b where id=:'bill';
select public.manage_farm_record(farm_id,'bills',id,to_jsonb(b),'delete') from public.bills b where id=:'bill';
select public.manage_farm_record(farm_id,'stock_moves',id,to_jsonb(m),'update','{"qty":15}') from public.stock_moves m where event='refuel';
do $$ begin
 if not exists(select from public.inputs where name='Diesel S10' and quantity=85 and carrying_value=510) then raise exception 'Edição do abastecimento incorreta'; end if;
 if exists(select from public.transactions where cost_basis='sale') then raise exception 'Liquidação pendente no caixa'; end if;
end $$;
select public.manage_farm_record(farm_id,'stock_moves',id,to_jsonb(m),'delete') from public.stock_moves m where event='refuel';
select public.manage_farm_record(farm_id,'work_orders',id,to_jsonb(j),'reopen') from public.work_orders j where id=:'job';
select public.manage_farm_record(farm_id,'order_inputs',order_id,to_jsonb(l),'update','{"dose_per_ha":1}') from public.order_inputs l;
select public.manage_farm_record(farm_id,'stage_history',id,to_jsonb(h),'update','{"stage":"V4"}') from public.stage_history h;
do $$ begin
 if not exists(select from public.work_orders where status='planned') or exists(select from public.stock_moves where event='work_order') then raise exception 'Estorno da OS falhou'; end if;
 if (select count(*) from public.stage_history)<>1 or not exists(select from public.crop_cycles where stage='V4') then raise exception 'Correção do estágio falhou'; end if;
end $$;
rollback to manager_checks;
select set_config('request.jwt.claim.sub',:'viewer_id',true);
do $$ begin
 if exists(select from public.map_preferences) or not exists(select from public.plots where color='#24a5a2')
 then raise exception 'Preferências pessoais ou cor compartilhada divergentes'; end if;
end $$;
do $$ begin
 if (select count(*) from public.inputs)<>2 then raise exception 'Viewer sem leitura';end if;
 begin
 perform public.manage_farm_record(current_setting('test.farm')::uuid,'work_orders',current_setting('test.job')::uuid,'{}','delete');
 raise exception 'Viewer conseguiu excluir OS';
 exception when insufficient_privilege then null;end;
 begin
 perform public.advance_order(current_setting('test.farm')::uuid,current_setting('test.job')::uuid,'cancelled');
 raise exception 'Viewer conseguiu escrever';
 exception when insufficient_privilege then null;end;
 begin
 update public.inputs set quantity=999;
 raise exception 'Saldo editável';
 exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claim.sub',:'outsider_id',true);
do $$ begin
 if exists(select from public.cycle_economics) or exists(select from public.inputs) then raise exception 'Vazamento de dados';end if;
end $$;
rollback;
