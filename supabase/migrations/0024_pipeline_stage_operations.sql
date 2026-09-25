-- Fase 4/5 — operações de etapas e funis, atômicas no banco.
--
-- 1) Histórico de etapa (deal_stage_history) passa a:
--    - guardar o NOME da etapa/funil de origem e destino (sobrevive à
--      exclusão da etapa: as FKs viram ON DELETE SET NULL);
--    - registrar o funil (from_pipeline_id / to_pipeline_id) e uma nota
--      ("Etapa movida para outro funil", "Etapa excluída"...);
--    - ser gravado por GATILHO no banco a cada mudança de etapa ou funil do
--      negócio, venha de onde vier (Kanban, detalhe, operações em massa).
--      O app deixa de inserir o histórico pelo navegador.
-- 2) Operações em massa (reordenar, mover etapa entre funis, excluir etapa
--    realocando negócios, mover negócios entre funis) são funções
--    transacionais: tudo ou nada. Elas marcam a transação com
--    mave.bulk_operation = 'on', o que:
--    - NÃO dispara automações de "negócio mudou de etapa" (decisão do
--      usuário para operações em massa);
--    - NÃO altera last_activity_at (mover em massa não é atividade
--      comercial e não deve zerar o alerta de "Estagnado").
-- 3) Permissões: reordenar/mover/excluir etapas exige admin (mesma regra
--    das policies de pipeline_stages). Mover negócios entre funis respeita
--    a RLS de deals (SECURITY INVOKER): cada um só move o que pode editar.
--
-- Reversão: supabase/rollbacks/0024_pipeline_stage_operations.down.sql

-- 1. Histórico -----------------------------------------------------------------

alter table deal_stage_history
  add column if not exists from_stage_name text,
  add column if not exists to_stage_name text,
  add column if not exists from_pipeline_id uuid references pipelines (id) on delete set null,
  add column if not exists to_pipeline_id uuid references pipelines (id) on delete set null,
  add column if not exists from_pipeline_name text,
  add column if not exists to_pipeline_name text,
  add column if not exists note text;

alter table deal_stage_history alter column to_stage_id drop not null;

alter table deal_stage_history drop constraint if exists deal_stage_history_from_stage_id_fkey;
alter table deal_stage_history
  add constraint deal_stage_history_from_stage_id_fkey
  foreign key (from_stage_id) references pipeline_stages (id) on delete set null;

alter table deal_stage_history drop constraint if exists deal_stage_history_to_stage_id_fkey;
alter table deal_stage_history
  add constraint deal_stage_history_to_stage_id_fkey
  foreign key (to_stage_id) references pipeline_stages (id) on delete set null;

-- Preenche nomes/funis dos registros já existentes
update deal_stage_history h
set from_stage_name = coalesce(h.from_stage_name, (select s.name from pipeline_stages s where s.id = h.from_stage_id)),
    to_stage_name = coalesce(h.to_stage_name, (select s.name from pipeline_stages s where s.id = h.to_stage_id)),
    from_pipeline_id = coalesce(h.from_pipeline_id, (select s.pipeline_id from pipeline_stages s where s.id = h.from_stage_id)),
    to_pipeline_id = coalesce(h.to_pipeline_id, (select s.pipeline_id from pipeline_stages s where s.id = h.to_stage_id)),
    from_pipeline_name = coalesce(
      h.from_pipeline_name,
      (select p.name from pipeline_stages s join pipelines p on p.id = s.pipeline_id where s.id = h.from_stage_id)
    ),
    to_pipeline_name = coalesce(
      h.to_pipeline_name,
      (select p.name from pipeline_stages s join pipelines p on p.id = s.pipeline_id where s.id = h.to_stage_id)
    );

create index if not exists deal_stage_history_deal_changed_idx
  on deal_stage_history (deal_id, changed_at desc);

-- Gatilho que grava o histórico
create or replace function public.log_deal_stage_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_stage text;
  v_to_stage text;
  v_from_pipeline text;
  v_to_pipeline text;
begin
  if new.stage_id is not distinct from old.stage_id
     and new.pipeline_id is not distinct from old.pipeline_id then
    return new;
  end if;

  select name into v_from_stage from pipeline_stages where id = old.stage_id;
  select name into v_to_stage from pipeline_stages where id = new.stage_id;
  select name into v_from_pipeline from pipelines where id = old.pipeline_id;
  select name into v_to_pipeline from pipelines where id = new.pipeline_id;

  insert into deal_stage_history (
    deal_id, from_stage_id, to_stage_id, from_stage_name, to_stage_name,
    from_pipeline_id, to_pipeline_id, from_pipeline_name, to_pipeline_name,
    note, changed_by
  ) values (
    new.id, old.stage_id, new.stage_id, v_from_stage, v_to_stage,
    old.pipeline_id, new.pipeline_id, v_from_pipeline, v_to_pipeline,
    nullif(current_setting('mave.history_note', true), ''),
    -- Sem usuário (script/service role): atribui ao responsável do negócio
    coalesce(auth.uid(), new.owner_id)
  );
  return new;
end;
$$;

drop trigger if exists deals_log_stage_change on deals;
create trigger deals_log_stage_change
  after update of stage_id, pipeline_id on deals
  for each row execute function public.log_deal_stage_change();

-- 2. Operações em massa não disparam automações nem contam como atividade ---

create or replace function public.handle_deal_stage_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rule record;
begin
  if current_setting('mave.bulk_operation', true) = 'on' then
    return new;
  end if;

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
  if tg_op = 'UPDATE' and current_setting('mave.bulk_operation', true) = 'on' then
    return new;
  end if;
  new.last_activity_at = now();
  return new;
end;
$$;

-- Garante que etapa e funil do negócio sejam coerentes
create or replace function public.check_deal_stage_pipeline()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not exists (
    select 1 from pipeline_stages where id = new.stage_id and pipeline_id = new.pipeline_id
  ) then
    raise exception 'A etapa escolhida não pertence ao funil do negócio.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists deals_check_stage_pipeline on deals;
create constraint trigger deals_check_stage_pipeline
  after insert or update of stage_id, pipeline_id on deals
  deferrable initially deferred
  for each row execute function public.check_deal_stage_pipeline();

-- 3. Funções transacionais -------------------------------------------------------

create or replace function public.require_admin()
returns void
language plpgsql
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem alterar as etapas dos funis.'
      using errcode = 'insufficient_privilege';
  end if;
end;
$$;

-- Renumera order_index de um funil (0..n-1) mantendo a ordem atual
create or replace function public.renumber_pipeline_stages(p_pipeline_id uuid)
returns void
language sql
set search_path = public
as $$
  update pipeline_stages s
  set order_index = r.rn - 1
  from (
    select id, row_number() over (order by order_index, name) as rn
    from pipeline_stages
    where pipeline_id = p_pipeline_id
  ) r
  where s.id = r.id and s.order_index is distinct from r.rn - 1;
$$;

-- Reordena as etapas de um funil. p_stage_ids = todas as etapas, na nova ordem.
create or replace function public.reorder_pipeline_stages(p_pipeline_id uuid, p_stage_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_count int;
begin
  perform public.require_admin();
  perform 1 from pipeline_stages where pipeline_id = p_pipeline_id for update;

  select count(*) into v_count from pipeline_stages where pipeline_id = p_pipeline_id;
  if v_count <> coalesce(array_length(p_stage_ids, 1), 0)
     or exists (
       select 1 from unnest(p_stage_ids) as x(id)
       where not exists (select 1 from pipeline_stages s where s.id = x.id and s.pipeline_id = p_pipeline_id)
     ) then
    raise exception 'A lista de etapas não corresponde ao funil. Recarregue a página e tente novamente.';
  end if;

  update pipeline_stages s
  set order_index = x.ord - 1
  from unnest(p_stage_ids) with ordinality as x(id, ord)
  where s.id = x.id;
end;
$$;

-- Move uma etapa para outro funil, na posição p_target_index (0 = primeira).
-- p_mode:
--   'with_deals' -> os negócios da etapa vão junto (mudam de funil);
--   'reassign'   -> os negócios ficam no funil de origem, na etapa
--                   p_reassign_stage_id.
create or replace function public.move_stage_to_pipeline(
  p_stage_id uuid,
  p_target_pipeline_id uuid,
  p_target_index int,
  p_mode text,
  p_reassign_stage_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_stage pipeline_stages%rowtype;
  v_deals int := 0;
begin
  perform public.require_admin();

  select * into v_stage from pipeline_stages where id = p_stage_id for update;
  if not found then
    raise exception 'Etapa não encontrada.';
  end if;
  if v_stage.pipeline_id = p_target_pipeline_id then
    raise exception 'A etapa já pertence a este funil.';
  end if;
  if not exists (select 1 from pipelines where id = p_target_pipeline_id) then
    raise exception 'Funil de destino não encontrado.';
  end if;

  perform set_config('mave.bulk_operation', 'on', true);

  if p_mode = 'with_deals' then
    perform set_config('mave.history_note', 'Etapa movida para outro funil (negócio foi junto)', true);
    -- a etapa muda de funil primeiro; a checagem etapa/funil é adiada
    update pipeline_stages set pipeline_id = p_target_pipeline_id where id = p_stage_id;
    update deals set pipeline_id = p_target_pipeline_id where stage_id = p_stage_id;
    get diagnostics v_deals = row_count;
  elsif p_mode = 'reassign' then
    if p_reassign_stage_id is null or not exists (
      select 1 from pipeline_stages
      where id = p_reassign_stage_id and pipeline_id = v_stage.pipeline_id and id <> p_stage_id
    ) then
      raise exception 'Escolha uma etapa do funil de origem para os negócios.';
    end if;
    perform set_config('mave.history_note', 'Etapa movida para outro funil (negócio realocado)', true);
    update deals set stage_id = p_reassign_stage_id where stage_id = p_stage_id;
    get diagnostics v_deals = row_count;
    update pipeline_stages set pipeline_id = p_target_pipeline_id where id = p_stage_id;
  else
    raise exception 'Modo inválido: %', p_mode;
  end if;

  -- Posição no funil de destino: abre espaço e encaixa a etapa
  update pipeline_stages
  set order_index = order_index + 1
  where pipeline_id = p_target_pipeline_id and id <> p_stage_id and order_index >= greatest(p_target_index, 0);
  update pipeline_stages set order_index = greatest(p_target_index, 0) where id = p_stage_id;

  perform public.renumber_pipeline_stages(v_stage.pipeline_id);
  perform public.renumber_pipeline_stages(p_target_pipeline_id);

  return jsonb_build_object('deals', v_deals);
end;
$$;

-- Exclui uma etapa. Se houver negócios nela, p_target_stage_id é obrigatório
-- (pode ser de outro funil: o negócio muda de funil junto). Automações que
-- apontavam para a etapa são desativadas (não ficam órfãs).
create or replace function public.delete_stage_with_reassign(
  p_stage_id uuid,
  p_target_stage_id uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_stage pipeline_stages%rowtype;
  v_target pipeline_stages%rowtype;
  v_deals int := 0;
  v_rules int := 0;
begin
  perform public.require_admin();

  select * into v_stage from pipeline_stages where id = p_stage_id for update;
  if not found then
    raise exception 'Etapa não encontrada.';
  end if;

  if exists (select 1 from deals where stage_id = p_stage_id) then
    if p_target_stage_id is null or p_target_stage_id = p_stage_id then
      raise exception 'Esta etapa tem negócios: escolha para onde eles vão antes de excluir.';
    end if;
    select * into v_target from pipeline_stages where id = p_target_stage_id;
    if not found then
      raise exception 'Etapa de destino não encontrada.';
    end if;

    perform set_config('mave.bulk_operation', 'on', true);
    perform set_config('mave.history_note', format('Etapa "%s" excluída', v_stage.name), true);
    update deals
    set stage_id = v_target.id, pipeline_id = v_target.pipeline_id
    where stage_id = p_stage_id;
    get diagnostics v_deals = row_count;
  end if;

  update automation_rules
  set active = false
  where active and (conditions_json ->> 'to_stage_id') = p_stage_id::text;
  get diagnostics v_rules = row_count;

  delete from pipeline_stages where id = p_stage_id;
  perform public.renumber_pipeline_stages(v_stage.pipeline_id);

  return jsonb_build_object('deals', v_deals, 'automations_disabled', v_rules);
end;
$$;

-- Fase 5: move negócios para outro funil/etapa. SECURITY INVOKER: a RLS de
-- deals decide quais o usuário pode mover; retorna quantos foram movidos.
create or replace function public.move_deals_to_pipeline(p_deal_ids uuid[], p_target_stage_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_target pipeline_stages%rowtype;
  v_moved int := 0;
begin
  select * into v_target from pipeline_stages where id = p_target_stage_id;
  if not found then
    raise exception 'Etapa de destino não encontrada.';
  end if;

  -- Um negócio movido por vez segue o fluxo normal (dispara automações);
  -- em massa, não — mesma regra das demais operações em massa.
  if coalesce(array_length(p_deal_ids, 1), 0) > 1 then
    perform set_config('mave.bulk_operation', 'on', true);
  end if;
  perform set_config('mave.history_note', 'Movido para outro funil', true);

  update deals
  set pipeline_id = v_target.pipeline_id, stage_id = v_target.id
  where id = any (p_deal_ids)
    and (pipeline_id <> v_target.pipeline_id or stage_id <> v_target.id);
  get diagnostics v_moved = row_count;

  return jsonb_build_object('moved', v_moved, 'requested', coalesce(array_length(p_deal_ids, 1), 0));
end;
$$;

revoke execute on function public.reorder_pipeline_stages(uuid, uuid[]) from public, anon;
revoke execute on function public.move_stage_to_pipeline(uuid, uuid, int, text, uuid) from public, anon;
revoke execute on function public.delete_stage_with_reassign(uuid, uuid) from public, anon;
revoke execute on function public.move_deals_to_pipeline(uuid[], uuid) from public, anon;
revoke execute on function public.require_admin() from public, anon;
revoke execute on function public.renumber_pipeline_stages(uuid) from public, anon;
grant execute on function public.reorder_pipeline_stages(uuid, uuid[]) to authenticated;
grant execute on function public.move_stage_to_pipeline(uuid, uuid, int, text, uuid) to authenticated;
grant execute on function public.delete_stage_with_reassign(uuid, uuid) to authenticated;
grant execute on function public.move_deals_to_pipeline(uuid[], uuid) to authenticated;
grant execute on function public.require_admin() to authenticated;
grant execute on function public.renumber_pipeline_stages(uuid) to authenticated;
