-- Workflow: filtros por tipo de evento e por funil, e resumo (contagens) para a diretoria.
--
-- 1. workflow_event_kind() — classifica cada linha do log em um tipo de evento
--    (negócio novo, movimentado no funil, ganho, perdido, congelado, organização
--    cadastrada...). Função IMMUTABLE usada numa coluna gerada: o histórico antigo
--    já nasce classificado, sem editar nenhum dado do log.
-- 2. audit_logs.event_kind (gerada) e audit_logs.pipeline_id (funil do negócio),
--    preenchida pelo gatilho; o histórico existente recebe o funil atual do negócio.
-- 3. audit_log_trigger() passa a gravar pipeline_id. Também corrige a busca do negócio
--    em exclusões (o negócio já não existe, e os vínculos eram zerados).
-- 4. workflow_summary() — contagens por tipo, responsável e funil com os mesmos
--    filtros da tela (security invoker: o RLS de audit_logs continua valendo).
--
-- Reversão: supabase/rollbacks/0030_workflow_filtros_resumo.down.sql

-- 1. Tipo de evento ----------------------------------------------------------------

create or replace function public.workflow_event_kind(p_table text, p_action text, p_changes jsonb)
returns text
language sql immutable parallel safe
as $$
  select case p_table
    when 'deals' then
      case
        when p_action = 'insert' then 'deal_created'
        when p_action = 'delete' then 'deal_deleted'
        when p_changes #>> '{status,new}' = 'won' then 'deal_won'
        when p_changes #>> '{status,new}' = 'lost' then 'deal_lost'
        when p_changes ? 'status' then 'deal_reopened'
        when p_changes ? 'stage_id' then 'deal_moved'
        when p_changes ? 'frozen_at' then
          case when p_changes #>> '{frozen_at,new}' is null then 'deal_unfrozen' else 'deal_frozen' end
        when p_changes ? 'owner_id' then 'deal_transferred'
        when p_changes ? 'value' then 'deal_value'
        else 'deal_updated'
      end
    when 'organizations' then 'organization_' || case p_action when 'insert' then 'created' when 'delete' then 'deleted' else 'updated' end
    when 'contacts' then 'contact_' || case p_action when 'insert' then 'created' when 'delete' then 'deleted' else 'updated' end
    when 'leads' then
      case
        when p_action = 'insert' then 'lead_created'
        when p_action = 'delete' then 'lead_deleted'
        when p_changes #>> '{status,new}' = 'converted' then 'lead_converted'
        else 'lead_updated'
      end
    when 'activities' then
      case
        when p_action = 'insert' then 'activity_created'
        when p_action = 'delete' then 'activity_deleted'
        when p_changes #>> '{done,new}' = 'true' then 'activity_done'
        else 'activity_updated'
      end
    when 'notes' then 'note_' || case p_action when 'insert' then 'created' when 'delete' then 'deleted' else 'updated' end
    when 'proposals' then 'proposal_' || case p_action when 'insert' then 'created' when 'delete' then 'deleted' else 'updated' end
    when 'attachments' then 'attachment_' || case p_action when 'insert' then 'created' when 'delete' then 'deleted' else 'updated' end
    else 'config'
  end;
$$;

-- 2. Colunas -----------------------------------------------------------------------

alter table audit_logs
  add column event_kind text generated always as (public.workflow_event_kind(table_name, action, changes)) stored,
  add column pipeline_id uuid;

-- Funil do negócio nos eventos antigos (só a coluna estruturada; o conteúdo do log não muda)
update audit_logs a
set pipeline_id = d.pipeline_id
from deals d
where a.deal_id = d.id and a.pipeline_id is null;

create index audit_logs_kind_idx on audit_logs (event_kind, occurred_at desc);
create index audit_logs_pipeline_idx on audit_logs (pipeline_id, occurred_at desc) where pipeline_id is not null;

-- 3. Gatilho -----------------------------------------------------------------------

create or replace function public.audit_log_trigger()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_actor_name text;
  v_rec jsonb;
  v_old jsonb;
  v_changes jsonb := '{}'::jsonb;
  v_key text;
  v_label text;
  v_deal uuid;
  v_org uuid;
  v_contact uuid;
  v_owner uuid;
  v_pipeline uuid;
  v_ref record;
  v_ignored constant text[] :=
    array['updated_at', 'last_activity_at', 'closed_at', 'preferences', 'created_at'];
begin
  if current_setting('mave.skip_audit', true) = 'on' then
    return null;
  end if;
  -- profiles via service role: registrado pelas server actions
  if tg_table_name = 'profiles' and v_actor is null then
    return null;
  end if;

  v_rec := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;

  if tg_op = 'UPDATE' then
    v_old := to_jsonb(old);
    for v_key in select jsonb_object_keys(v_rec) loop
      continue when v_key = any (v_ignored);
      if v_rec -> v_key is distinct from v_old -> v_key then
        v_changes := v_changes || jsonb_build_object(
          v_key,
          jsonb_build_object(
            'old', public.audit_value(v_key, v_old -> v_key),
            'new', public.audit_value(v_key, v_rec -> v_key)
          )
        );
      end if;
    end loop;
    if v_changes = '{}'::jsonb then
      return null; -- só colunas de ruído mudaram
    end if;
  else
    for v_key in select jsonb_object_keys(v_rec) loop
      continue when v_key = any (v_ignored) or jsonb_typeof(v_rec -> v_key) = 'null';
      v_changes := v_changes || jsonb_build_object(v_key, public.audit_value(v_key, v_rec -> v_key));
    end loop;
  end if;

  v_label := left(
    coalesce(
      v_rec ->> 'title', v_rec ->> 'name', v_rec ->> 'full_name', v_rec ->> 'subject',
      v_rec ->> 'file_name', v_rec ->> 'label', v_rec ->> 'trigger_event', v_rec ->> 'content',
      public.audit_resolve_ref('deal_id', v_rec ->> 'deal_id')
    ),
    120
  );

  -- Vínculos estruturados para o Workflow (filtrar por negócio/organização/contato/responsável/funil)
  v_owner := coalesce(nullif(v_rec ->> 'owner_id', '')::uuid, nullif(v_rec ->> 'created_by', '')::uuid);
  case tg_table_name
    when 'deals' then
      v_deal := nullif(v_rec ->> 'id', '')::uuid;
      v_org := nullif(v_rec ->> 'organization_id', '')::uuid;
      v_contact := nullif(v_rec ->> 'contact_id', '')::uuid;
      v_pipeline := nullif(v_rec ->> 'pipeline_id', '')::uuid;
    when 'contacts' then
      v_contact := nullif(v_rec ->> 'id', '')::uuid;
      v_org := nullif(v_rec ->> 'organization_id', '')::uuid;
    when 'organizations' then
      v_org := nullif(v_rec ->> 'id', '')::uuid;
    when 'activities', 'notes', 'proposals' then
      v_deal := nullif(v_rec ->> 'deal_id', '')::uuid;
      v_contact := nullif(v_rec ->> 'contact_id', '')::uuid;
    when 'attachments' then
      case v_rec ->> 'entity_type'
        when 'deal' then v_deal := nullif(v_rec ->> 'entity_id', '')::uuid;
        when 'contact' then v_contact := nullif(v_rec ->> 'entity_id', '')::uuid;
        when 'organization' then v_org := nullif(v_rec ->> 'entity_id', '')::uuid;
        else null;
      end case;
    else null;
  end case;

  if v_deal is not null and (v_org is null or v_contact is null or v_owner is null or v_pipeline is null) then
    select d.organization_id, d.contact_id, d.owner_id, d.pipeline_id into v_ref from deals d where d.id = v_deal;
    if found then
      v_org := coalesce(v_org, v_ref.organization_id);
      v_contact := coalesce(v_contact, v_ref.contact_id);
      v_owner := coalesce(v_owner, v_ref.owner_id);
      v_pipeline := coalesce(v_pipeline, v_ref.pipeline_id);
    end if;
  end if;
  if v_contact is not null and (v_org is null or v_owner is null) then
    select c.organization_id, c.owner_id into v_ref from contacts c where c.id = v_contact;
    if found then
      v_org := coalesce(v_org, v_ref.organization_id);
      v_owner := coalesce(v_owner, v_ref.owner_id);
    end if;
  end if;
  if v_org is not null and v_owner is null then
    select o.owner_id into v_owner from organizations o where o.id = v_org;
  end if;

  if v_actor is not null then
    select full_name into v_actor_name from profiles where id = v_actor;
    v_actor_name := coalesce(v_actor_name, 'Usuário removido');
  else
    v_actor_name := 'Sistema';
  end if;

  insert into audit_logs (actor_id, actor_name, action, table_name, record_id, record_label, changes,
                          deal_id, organization_id, contact_id, owner_id, pipeline_id)
  values (
    v_actor,
    v_actor_name,
    lower(tg_op),
    tg_table_name,
    nullif(v_rec ->> 'id', '')::uuid,
    v_label,
    v_changes,
    v_deal, v_org, v_contact, v_owner, v_pipeline
  );

  return null;
end;
$$;

revoke execute on function public.audit_log_trigger() from public, anon, authenticated;

-- 4. Resumo --------------------------------------------------------------------------
-- Contagem por tipo ignora p_kinds (os cartões mostram todos os tipos); responsável e
-- funil respeitam p_kinds (mostram onde estão os eventos já filtrados).

create or replace function public.workflow_summary(
  p_from timestamptz,
  p_to timestamptz,
  p_actor uuid default null,
  p_owner uuid default null,
  p_org uuid default null,
  p_deal uuid default null,
  p_contact uuid default null,
  p_pipeline uuid default null,
  p_kinds text[] default null,
  p_search text default null
)
returns table (dimension text, key text, total bigint)
language sql stable
as $$
  with f as (
    select event_kind, owner_id, pipeline_id
    from audit_logs
    where occurred_at >= p_from
      and occurred_at <= p_to
      and (p_actor is null or actor_id = p_actor)
      and (p_owner is null or owner_id = p_owner)
      and (p_org is null or organization_id = p_org)
      and (p_deal is null or deal_id = p_deal)
      and (p_contact is null or contact_id = p_contact)
      and (p_pipeline is null or pipeline_id = p_pipeline)
      and (coalesce(btrim(p_search), '') = '' or record_label ilike '%' || btrim(p_search) || '%')
  )
  select 'kind', event_kind, count(*) from f group by event_kind
  union all
  select 'owner', owner_id::text, count(*) from f
    where p_kinds is null or event_kind = any (p_kinds) group by owner_id
  union all
  select 'pipeline', pipeline_id::text, count(*) from f
    where p_kinds is null or event_kind = any (p_kinds) group by pipeline_id;
$$;

revoke execute on function public.workflow_summary(timestamptz, timestamptz, uuid, uuid, uuid, uuid, uuid, uuid, text[], text) from public, anon;
grant execute on function public.workflow_summary(timestamptz, timestamptz, uuid, uuid, uuid, uuid, uuid, uuid, text[], text) to authenticated;
