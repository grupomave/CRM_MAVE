-- Logs de auditoria: quem incluiu, alterou ou excluiu o quê, e quando.
--
-- - Tabela audit_logs, gravada SOMENTE por gatilhos no banco (security definer),
--   então vale para qualquer origem (telas, API, automações) e não pode ser
--   adulterada pelo app: ninguém tem policy de insert/update/delete.
-- - Leitura restrita a administradores (Configurações > Logs de auditoria).
-- - Em alterações, guarda só os campos que mudaram (antes/depois). Colunas de
--   ruído (updated_at, last_activity_at, closed_at, preferences) são ignoradas;
--   se só elas mudaram, nada é registrado.
-- - Colunas *_id são gravadas com o NOME do registro referenciado (ex.: etapa,
--   responsável), para o log continuar legível mesmo se o registro for excluído.
-- - Quem fez: auth.uid(). Operações sem usuário (scripts/service role) aparecem
--   como "Sistema". Scripts de carga em massa podem silenciar o log com
--   `select set_config('mave.skip_audit', 'on', true)` na transação.
-- - profiles: ações feitas via service role (criar/editar/excluir usuário) são
--   registradas pelas server actions (src/lib/actions/users.ts), pois o gatilho
--   não sabe quem é o admin nesses casos.
--
-- Reversão: supabase/rollbacks/0028_audit_logs.down.sql

create table audit_logs (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id uuid,
  actor_name text not null default 'Sistema',
  action text not null check (action in ('insert', 'update', 'delete')),
  table_name text not null,
  record_id uuid,
  record_label text,
  changes jsonb not null default '{}'::jsonb
);

create index audit_logs_occurred_at_idx on audit_logs (occurred_at desc);
create index audit_logs_table_idx on audit_logs (table_name, occurred_at desc);
create index audit_logs_actor_idx on audit_logs (actor_id, occurred_at desc);
create index audit_logs_record_idx on audit_logs (record_id);

alter table audit_logs enable row level security;

create policy "audit_logs_admin_select" on audit_logs for select
  using ((select public.is_admin()));

revoke all on audit_logs from anon, authenticated;
grant select on audit_logs to authenticated;

-- Nome legível de um id referenciado por uma coluna *_id.
create function public.audit_resolve_ref(p_col text, p_val text)
returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  v_id uuid;
  v_name text;
begin
  if p_val is null then return null; end if;
  begin
    v_id := p_val::uuid;
  exception when others then
    return p_val;
  end;

  if p_col in ('owner_id', 'original_owner_id', 'author_id', 'created_by', 'uploaded_by',
               'approved_by', 'changed_by', 'manager_id', 'user_id') then
    select full_name into v_name from profiles where profiles.id = v_id;
  elsif p_col = 'stage_id' then
    select name into v_name from pipeline_stages where pipeline_stages.id = v_id;
  elsif p_col = 'pipeline_id' then
    select name into v_name from pipelines where pipelines.id = v_id;
  elsif p_col = 'organization_id' then
    select name into v_name from organizations where organizations.id = v_id;
  elsif p_col = 'contact_id' then
    select name into v_name from contacts where contacts.id = v_id;
  elsif p_col in ('deal_id', 'converted_deal_id') then
    select title into v_name from deals where deals.id = v_id;
  elsif p_col = 'lost_reason_id' then
    select name into v_name from lost_reasons where lost_reasons.id = v_id;
  elsif p_col = 'team_id' then
    select name into v_name from teams where teams.id = v_id;
  elsif p_col = 'custom_field_id' then
    select label into v_name from custom_fields where custom_fields.id = v_id;
  end if;

  return coalesce(v_name, p_val);
end;
$$;

-- Valor de coluna pronto para o log: *_id vira nome; textos longos são cortados.
create function public.audit_value(p_col text, p_val jsonb)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
begin
  if p_val is null or jsonb_typeof(p_val) = 'null' then
    return 'null'::jsonb;
  end if;
  if jsonb_typeof(p_val) = 'string' then
    if p_col like '%\_id' then
      return to_jsonb(public.audit_resolve_ref(p_col, p_val #>> '{}'));
    end if;
    return to_jsonb(left(p_val #>> '{}', 300));
  end if;
  if jsonb_typeof(p_val) in ('object', 'array') then
    return to_jsonb(left(p_val::text, 300));
  end if;
  return p_val;
end;
$$;

create function public.audit_log_trigger()
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

  if v_actor is not null then
    select full_name into v_actor_name from profiles where id = v_actor;
    v_actor_name := coalesce(v_actor_name, 'Usuário removido');
  else
    v_actor_name := 'Sistema';
  end if;

  insert into audit_logs (actor_id, actor_name, action, table_name, record_id, record_label, changes)
  values (
    v_actor,
    v_actor_name,
    lower(tg_op),
    tg_table_name,
    nullif(v_rec ->> 'id', '')::uuid,
    v_label,
    v_changes
  );

  return null;
end;
$$;

revoke execute on function public.audit_resolve_ref(text, text) from public, anon, authenticated;
revoke execute on function public.audit_value(text, jsonb) from public, anon, authenticated;
revoke execute on function public.audit_log_trigger() from public, anon, authenticated;

-- Tabelas auditadas ------------------------------------------------------------
create trigger audit_deals after insert or update or delete on deals
  for each row execute function public.audit_log_trigger();
create trigger audit_contacts after insert or update or delete on contacts
  for each row execute function public.audit_log_trigger();
create trigger audit_organizations after insert or update or delete on organizations
  for each row execute function public.audit_log_trigger();
create trigger audit_leads after insert or update or delete on leads
  for each row execute function public.audit_log_trigger();
create trigger audit_activities after insert or update or delete on activities
  for each row execute function public.audit_log_trigger();
create trigger audit_notes after insert or update or delete on notes
  for each row execute function public.audit_log_trigger();
create trigger audit_proposals after insert or update or delete on proposals
  for each row execute function public.audit_log_trigger();
create trigger audit_attachments after insert or update or delete on attachments
  for each row execute function public.audit_log_trigger();
create trigger audit_pipelines after insert or update or delete on pipelines
  for each row execute function public.audit_log_trigger();
create trigger audit_pipeline_stages after insert or update or delete on pipeline_stages
  for each row execute function public.audit_log_trigger();
create trigger audit_lost_reasons after insert or update or delete on lost_reasons
  for each row execute function public.audit_log_trigger();
create trigger audit_custom_fields after insert or update or delete on custom_fields
  for each row execute function public.audit_log_trigger();
create trigger audit_automation_rules after insert or update or delete on automation_rules
  for each row execute function public.audit_log_trigger();
create trigger audit_teams after insert or update or delete on teams
  for each row execute function public.audit_log_trigger();
create trigger audit_profiles after insert or update or delete on profiles
  for each row execute function public.audit_log_trigger();
