begin;
alter table public.bills add column if not exists category text check (length(trim(category)) > 0);
grant insert(category) on public.bills to authenticated;

create or replace function public.settle_bill(p_farm uuid,p_bill uuid,p_date date) returns uuid
language plpgsql security definer set search_path='' as $$
declare bill public.bills; plot uuid; movement uuid;
begin
 perform agro_internal.require_writer(p_farm);
 select * into strict bill from public.bills where farm_id=p_farm and id=p_bill for update;
 if bill.transaction_id is not null then return bill.transaction_id; end if;
 if p_date is null or p_date>current_date then raise exception 'Data de liquidação inválida'; end if;
 select plot_id into plot from public.crop_cycles where id=bill.cycle_id;
 insert into public.transactions(farm_id,plot_id,cycle_id,amount,category,description,transaction_date,created_by,type,cost_basis)
 values(p_farm,plot,bill.cycle_id,bill.amount,coalesce(bill.category,'Outros'),bill.description,p_date,auth.uid(),
   case when bill.kind='payable' then 'expense' else 'income' end,bill.basis) returning id into movement;
 update public.bills set settled_on=p_date,transaction_id=movement where id=p_bill;
 return movement;
end $$;
commit;
