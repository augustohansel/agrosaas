create or replace function agro_internal.protect_cash() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists (select 1 from public.bills where transaction_id = old.id) then
    if tg_op = 'DELETE' then
      raise exception 'Este lançamento está vinculado a um título liquidado.';
    end if;
    if (to_jsonb(new) - 'category') is distinct from (to_jsonb(old) - 'category') then
      raise exception 'Apenas a categoria pode ser alterada em um lançamento liquidado.';
    end if;
    if nullif(btrim(new.category), '') is null then
      raise exception 'Informe a categoria do lançamento.';
    end if;
    if new.category is distinct from old.category then
      update public.bills set category = new.category
      where transaction_id = old.id and farm_id = old.farm_id;
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.farm_id is distinct from old.farm_id or new.created_by is distinct from old.created_by then
    raise exception 'Origem imutável';
  end if;
  return new;
end $$;
