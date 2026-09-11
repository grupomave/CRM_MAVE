-- Row Level Security — hierarquia admin / gestor / vendedor (prompt.md seção 6)

-- Funções auxiliares (SECURITY DEFINER: leem profiles sem reaplicar RLS,
-- evitando recursão e centralizando a regra de visibilidade em um só lugar).

create function public.current_role()
returns user_role
language sql security definer stable set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create function public.current_team_id()
returns uuid
language sql security definer stable set search_path = public
as $$
  select team_id from profiles where id = auth.uid();
$$;

create function public.is_admin()
returns boolean
language sql security definer stable set search_path = public
as $$
  select coalesce((select role = 'admin' from profiles where id = auth.uid()), false);
$$;

-- true se o usuário atual pode ver/editar um registro cujo "dono" é target_owner_id:
-- é o próprio dono, é admin, ou é gestor da mesma equipe do dono.
create function public.can_access_owner(target_owner_id uuid)
returns boolean
language sql security definer stable set search_path = public
as $$
  select
    target_owner_id = auth.uid()
    or public.is_admin()
    or (
      public.current_role() = 'gestor'
      and exists (
        select 1 from profiles p
        where p.id = target_owner_id and p.team_id = public.current_team_id()
      )
    );
$$;

-- profiles ------------------------------------------------------------------

alter table profiles enable row level security;

create policy "profiles_select" on profiles for select using (
  id = auth.uid()
  or public.is_admin()
  or (public.current_role() = 'gestor' and team_id = public.current_team_id())
);

create policy "profiles_update" on profiles for update
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- Um usuário comum pode editar seu próprio nome/avatar, mas não pode se
-- auto-promover trocando role/team_id — só admin pode.
create function public.prevent_self_role_escalation()
returns trigger language plpgsql as $$
begin
  if not public.is_admin() then
    if new.role <> old.role or new.team_id is distinct from old.team_id then
      raise exception 'Apenas administradores podem alterar papel ou equipe.';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_prevent_self_role_escalation
  before update on profiles
  for each row execute procedure public.prevent_self_role_escalation();

-- teams -----------------------------------------------------------------

alter table teams enable row level security;

create policy "teams_select_all" on teams for select using (true);
create policy "teams_admin_write" on teams for insert with check (public.is_admin());
create policy "teams_admin_update" on teams for update using (public.is_admin()) with check (public.is_admin());
create policy "teams_admin_delete" on teams for delete using (public.is_admin());

-- organizations / contacts / deals / leads / activities / notes ------------
-- mesmo padrão de 3 níveis (vendedor dono / gestor da equipe / admin total)

create policy "organizations_access" on organizations for all
  using (public.can_access_owner(owner_id))
  with check (public.can_access_owner(owner_id));
alter table organizations enable row level security;

create policy "contacts_access" on contacts for all
  using (public.can_access_owner(owner_id))
  with check (public.can_access_owner(owner_id));
alter table contacts enable row level security;

create policy "deals_access" on deals for all
  using (public.can_access_owner(owner_id))
  with check (public.can_access_owner(owner_id));
alter table deals enable row level security;

create policy "leads_access" on leads for all
  using (public.can_access_owner(owner_id))
  with check (public.can_access_owner(owner_id));
alter table leads enable row level security;

create policy "activities_access" on activities for all
  using (public.can_access_owner(owner_id))
  with check (public.can_access_owner(owner_id));
alter table activities enable row level security;

create policy "notes_access" on notes for all
  using (public.can_access_owner(author_id))
  with check (public.can_access_owner(author_id));
alter table notes enable row level security;

create policy "attachments_access" on attachments for all
  using (public.can_access_owner(uploaded_by))
  with check (public.can_access_owner(uploaded_by));
alter table attachments enable row level security;

-- deal_stage_history: a visibilidade segue o negócio relacionado, não um
-- "dono" próprio da linha (a linha é só um registro de auditoria).

alter table deal_stage_history enable row level security;

create policy "deal_stage_history_select" on deal_stage_history for select using (
  exists (
    select 1 from deals d
    where d.id = deal_stage_history.deal_id
      and public.can_access_owner(d.owner_id)
  )
);

create policy "deal_stage_history_insert" on deal_stage_history for insert
  with check (changed_by = auth.uid());

-- notifications: cada usuário só vê e só marca como lida a própria notificação.
-- Inserts são feitos pelo gatilho de automação (SECURITY DEFINER, ver
-- 0004_automation_engine.sql), então não há policy de insert para clientes.

alter table notifications enable row level security;

create policy "notifications_select_own" on notifications for select
  using (user_id = auth.uid());

create policy "notifications_update_own" on notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- pipelines / pipeline_stages / custom_fields / automation_rules:
-- configuração global da empresa — todo mundo lê, só admin escreve.

alter table pipelines enable row level security;
create policy "pipelines_select_all" on pipelines for select using (true);
create policy "pipelines_admin_write" on pipelines for insert with check (public.is_admin());
create policy "pipelines_admin_update" on pipelines for update using (public.is_admin()) with check (public.is_admin());
create policy "pipelines_admin_delete" on pipelines for delete using (public.is_admin());

alter table pipeline_stages enable row level security;
create policy "pipeline_stages_select_all" on pipeline_stages for select using (true);
create policy "pipeline_stages_admin_write" on pipeline_stages for insert with check (public.is_admin());
create policy "pipeline_stages_admin_update" on pipeline_stages for update using (public.is_admin()) with check (public.is_admin());
create policy "pipeline_stages_admin_delete" on pipeline_stages for delete using (public.is_admin());

alter table custom_fields enable row level security;
create policy "custom_fields_select_all" on custom_fields for select using (true);
create policy "custom_fields_admin_write" on custom_fields for insert with check (public.is_admin());
create policy "custom_fields_admin_update" on custom_fields for update using (public.is_admin()) with check (public.is_admin());
create policy "custom_fields_admin_delete" on custom_fields for delete using (public.is_admin());

alter table automation_rules enable row level security;
create policy "automation_rules_select_all" on automation_rules for select using (true);
create policy "automation_rules_admin_write" on automation_rules for insert with check (public.is_admin());
create policy "automation_rules_admin_update" on automation_rules for update using (public.is_admin()) with check (public.is_admin());
create policy "automation_rules_admin_delete" on automation_rules for delete using (public.is_admin());

-- custom_field_values: simplificação da v1 — qualquer usuário autenticado lê
-- e escreve (o valor em si não é sensível além do que a tela já expõe).
-- Evolução futura: restringir por visibilidade da entidade (deal/contact/org).

alter table custom_field_values enable row level security;
create policy "custom_field_values_authenticated" on custom_field_values for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
