-- Reverte 0024_pipeline_stage_operations.sql.
--
-- ATENÇÃO: depois do rollback o app (versão com as Fases 4/5) deixa de
-- gravar histórico de etapa — reverta o código junto. Linhas de histórico
-- cuja etapa já foi excluída (to_stage_id nulo) são mantidas; nesse caso
-- to_stage_id continua aceitando nulo (ver bloco DO abaixo).

drop function if exists public.move_deals_to_pipeline(uuid[], uuid);
drop function if exists public.delete_stage_with_reassign(uuid, uuid);
drop function if exists public.move_stage_to_pipeline(uuid, uuid, int, text, uuid);
drop function if exists public.reorder_pipeline_stages(uuid, uuid[]);
drop function if exists public.renumber_pipeline_stages(uuid);
drop function if exists public.require_admin();

drop trigger if exists deals_check_stage_pipeline on deals;
drop function if exists public.check_deal_stage_pipeline();

drop trigger if exists deals_log_stage_change on deals;
drop function if exists public.log_deal_stage_change();

-- Versões originais (0004 / 0014)
create or replace function public.handle_deal_stage_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rule record;
begin
  for rule in
    select * from automation_rules
    where active
      and trigger_event = 'deal_stage_changed'
      and (conditions_json ->> 'to_stage_id') = new.stage_id::text
  loop
    perform public.apply_automation_actions(
      rule.actions_json, new.id, new.title, new.owner_id, auth.uid()
    );
  end loop;
  return new;
end;
$$;

create or replace function public.touch_deal_last_activity_on_deal_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.last_activity_at = now();
  return new;
end;
$$;

drop index if exists deal_stage_history_deal_changed_idx;

alter table deal_stage_history drop constraint if exists deal_stage_history_from_stage_id_fkey;
alter table deal_stage_history
  add constraint deal_stage_history_from_stage_id_fkey
  foreign key (from_stage_id) references pipeline_stages (id);
alter table deal_stage_history drop constraint if exists deal_stage_history_to_stage_id_fkey;
alter table deal_stage_history
  add constraint deal_stage_history_to_stage_id_fkey
  foreign key (to_stage_id) references pipeline_stages (id);

do $$
begin
  if not exists (select 1 from deal_stage_history where to_stage_id is null) then
    alter table deal_stage_history alter column to_stage_id set not null;
  else
    raise notice 'Há histórico de etapas excluídas: to_stage_id continua aceitando nulo.';
  end if;
end;
$$;

alter table deal_stage_history
  drop column if exists note,
  drop column if exists to_pipeline_name,
  drop column if exists from_pipeline_name,
  drop column if exists to_pipeline_id,
  drop column if exists from_pipeline_id,
  drop column if exists to_stage_name,
  drop column if exists from_stage_name;
