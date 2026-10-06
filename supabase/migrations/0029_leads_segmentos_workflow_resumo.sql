-- Evolução 2026-10: Leads, Segmentos, Workflow e Resumo diário.
--
-- 1. lead_sources  — Origens de lead cadastráveis (Leads > Origem vira lista).
-- 2. segments      — Segmentos cadastráveis (substitui o texto livre "Setor" das
--                    organizações). Os valores antigos de organizations.sector são
--                    migrados para segments + organizations.segment_id.
-- 3. leads         — novos campos: source_id, phone (telefone), mobile
--                    (smartphone/WhatsApp) e email. O responsável já existia (owner_id).
-- 4. organizations — segment_id + campos de endereço preenchidos pela consulta de
--                    CNPJ (número, complemento, bairro, CEP, e-mail).
-- 5. Workflow      — a linha do tempo reutiliza audit_logs (guardado para sempre, só
--                    daqui para frente, sem backfill). Acrescentamos colunas
--                    estruturadas (negócio, organização, contato, responsável) para
--                    filtrar, e liberamos a leitura para gestores (escopo da equipe).
-- 6. digest_settings / digest_log — configuração e controle do e-mail diário das 08:00.
--
-- Reversão: supabase/rollbacks/0029_leads_segmentos_workflow_resumo.down.sql

-- 1 e 2. Origens e segmentos --------------------------------------------------

create table lead_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  is_active boolean not null default true,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index lead_sources_name_key on lead_sources (lower(btrim(name)));

create table segments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  is_active boolean not null default true,
  order_index integer not null default 0,
  created_at timestamptz not null default now()
);
create unique index segments_name_key on segments (lower(btrim(name)));

alter table lead_sources enable row level security;
alter table segments enable row level security;

-- Leitura para todos; escrita para administrador e gestor.
create policy "lead_sources_select_all" on lead_sources for select using (true);
create policy "lead_sources_manage_insert" on lead_sources for insert
  with check ((select public.current_role()) in ('admin', 'gestor'));
create policy "lead_sources_manage_update" on lead_sources for update
  using ((select public.current_role()) in ('admin', 'gestor'))
  with check ((select public.current_role()) in ('admin', 'gestor'));
create policy "lead_sources_manage_delete" on lead_sources for delete
  using ((select public.current_role()) in ('admin', 'gestor'));

create policy "segments_select_all" on segments for select using (true);
create policy "segments_manage_insert" on segments for insert
  with check ((select public.current_role()) in ('admin', 'gestor'));
create policy "segments_manage_update" on segments for update
  using ((select public.current_role()) in ('admin', 'gestor'))
  with check ((select public.current_role()) in ('admin', 'gestor'));
create policy "segments_manage_delete" on segments for delete
  using ((select public.current_role()) in ('admin', 'gestor'));

-- Carga inicial: valores já usados + sugestões comuns (a carga em massa não vai pro log)
select set_config('mave.skip_audit', 'on', true);

insert into lead_sources (name, order_index)
select name, row_number() over (order by name) - 1
from (
  select distinct on (lower(btrim(src))) btrim(src) as name
  from (
    select source as src from leads
    union all select source from deals
    union all select unnest(array['Site', 'Indicação', 'Evento', 'WhatsApp', 'Telefone', 'E-mail', 'Redes sociais'])
  ) s
  where src is not null and btrim(src) <> ''
  order by lower(btrim(src)), btrim(src)
) d;

insert into segments (name, order_index)
select name, row_number() over (order by name) - 1
from (
  select distinct on (lower(btrim(sector))) btrim(sector) as name
  from organizations
  where sector is not null and btrim(sector) <> ''
  order by lower(btrim(sector)), btrim(sector)
) d;

-- 3. leads ---------------------------------------------------------------------

alter table leads
  add column source_id uuid references lead_sources (id) on delete restrict,
  add column phone text,
  add column mobile text,
  add column email text;
create index leads_source_id_idx on leads (source_id);
create index if not exists leads_owner_id_idx on leads (owner_id);

update leads l
set source_id = s.id
from lead_sources s
where l.source is not null and lower(btrim(l.source)) = lower(btrim(s.name));

-- Aproveita o campo "contato" antigo quando ele é claramente um e-mail ou telefone
update leads set email = lower(btrim(contact_info))
where email is null and contact_info ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$';

update leads set mobile = btrim(contact_info)
where mobile is null and email is null
  and regexp_replace(coalesce(contact_info, ''), '\D', '', 'g') ~ '^(55)?\d{2}9\d{8}$';

update leads set phone = btrim(contact_info)
where phone is null and mobile is null and email is null
  and regexp_replace(coalesce(contact_info, ''), '\D', '', 'g') ~ '^(55)?\d{2}[2-8]\d{7}$';

-- 4. organizations -------------------------------------------------------------

alter table organizations
  add column segment_id uuid references segments (id) on delete restrict,
  add column address_number text,
  add column address_complement text,
  add column neighborhood text,
  add column zip_code text,
  add column email text;
create index organizations_segment_id_idx on organizations (segment_id);

update organizations o
set segment_id = s.id
from segments s
where o.sector is not null and lower(btrim(o.sector)) = lower(btrim(s.name));
-- organizations.sector fica sem uso (a UI passa a usar segment_id).

-- 5. Workflow (audit_logs) -----------------------------------------------------

alter table audit_logs
  add column deal_id uuid,
  add column organization_id uuid,
  add column contact_id uuid,
  add column owner_id uuid;

create index audit_logs_deal_idx on audit_logs (deal_id, occurred_at desc) where deal_id is not null;
create index audit_logs_org_idx on audit_logs (organization_id, occurred_at desc) where organization_id is not null;
create index audit_logs_contact_idx on audit_logs (contact_id, occurred_at desc) where contact_id is not null;
create index audit_logs_owner_idx on audit_logs (owner_id, occurred_at desc) where owner_id is not null;

-- Gestor enxerga os eventos de registros da própria equipe (admin já via tudo)
create policy "audit_logs_gestor_select" on audit_logs for select
  using (
    (select public.current_role()) = 'gestor'
    and owner_id is not null
    and (select public.can_access_owner(owner_id))
  );

create or replace function public.audit_resolve_ref(p_col text, p_val text)
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
  elsif p_col = 'segment_id' then
    select name into v_name from segments where segments.id = v_id;
  elsif p_col = 'source_id' then
    select name into v_name from lead_sources where lead_sources.id = v_id;
  end if;

  return coalesce(v_name, p_val);
end;
$$;

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

  -- Vínculos estruturados para o Workflow (filtrar por negócio/organização/contato/responsável)
  v_owner := coalesce(nullif(v_rec ->> 'owner_id', '')::uuid, nullif(v_rec ->> 'created_by', '')::uuid);
  case tg_table_name
    when 'deals' then
      v_deal := nullif(v_rec ->> 'id', '')::uuid;
      v_org := nullif(v_rec ->> 'organization_id', '')::uuid;
      v_contact := nullif(v_rec ->> 'contact_id', '')::uuid;
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

  if v_deal is not null and (v_org is null or v_contact is null or v_owner is null) then
    select coalesce(v_org, d.organization_id), coalesce(v_contact, d.contact_id), coalesce(v_owner, d.owner_id)
      into v_org, v_contact, v_owner
    from deals d where d.id = v_deal;
  end if;
  if v_contact is not null and (v_org is null or v_owner is null) then
    select coalesce(v_org, c.organization_id), coalesce(v_owner, c.owner_id)
      into v_org, v_owner
    from contacts c where c.id = v_contact;
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
                          deal_id, organization_id, contact_id, owner_id)
  values (
    v_actor,
    v_actor_name,
    lower(tg_op),
    tg_table_name,
    nullif(v_rec ->> 'id', '')::uuid,
    v_label,
    v_changes,
    v_deal, v_org, v_contact, v_owner
  );

  return null;
end;
$$;

revoke execute on function public.audit_resolve_ref(text, text) from public, anon, authenticated;
revoke execute on function public.audit_log_trigger() from public, anon, authenticated;

create trigger audit_lead_sources after insert or update or delete on lead_sources
  for each row execute function public.audit_log_trigger();
create trigger audit_segments after insert or update or delete on segments
  for each row execute function public.audit_log_trigger();

-- 6. Resumo diário por e-mail ----------------------------------------------------

create table digest_settings (
  id integer primary key default 1 check (id = 1),
  enabled boolean not null default true,
  include_today boolean not null default true,
  include_overdue boolean not null default true,
  notify_sellers boolean not null default true,
  notify_managers boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into digest_settings (id) values (1);

alter table digest_settings enable row level security;
create policy "digest_settings_select" on digest_settings for select
  using ((select public.current_role()) in ('admin', 'gestor'));
create policy "digest_settings_update" on digest_settings for update
  using ((select public.current_role()) in ('admin', 'gestor'))
  with check ((select public.current_role()) in ('admin', 'gestor'));

create trigger digest_settings_set_updated_at
  before update on digest_settings
  for each row execute procedure public.set_updated_at();
create trigger audit_digest_settings after update on digest_settings
  for each row execute function public.audit_log_trigger();

-- Controle de envio (idempotência do cron). Só o service role acessa.
create table digest_log (
  id bigint generated always as identity primary key,
  sent_on date not null,
  recipient_id uuid not null references profiles (id) on delete cascade,
  recipient_email text not null,
  kind text not null check (kind in ('seller', 'manager')),
  activities_count integer not null default 0,
  status text not null check (status in ('sent', 'error')),
  error text,
  sent_at timestamptz not null default now()
);
create unique index digest_log_unique_idx on digest_log (sent_on, recipient_id, kind) where status = 'sent';
alter table digest_log enable row level security;
revoke all on digest_log from anon, authenticated;
