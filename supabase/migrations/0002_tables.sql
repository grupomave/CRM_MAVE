-- Schema principal do CRM Grupo Mave (ver prompt.md seção 4)

create extension if not exists "pgcrypto";

-- Times e usuários -----------------------------------------------------

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  manager_id uuid references auth.users (id) on delete set null
);

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role user_role not null default 'vendedor',
  team_id uuid references teams (id) on delete set null,
  avatar_url text
);

alter table teams
  add constraint teams_manager_id_fkey_profiles
  foreign key (manager_id) references profiles (id) on delete set null;

-- Cria automaticamente um profile quando um usuário se cadastra no Supabase Auth
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email),
    'vendedor'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Organizações e contatos ------------------------------------------------

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  cnpj text,
  address text,
  sector text,
  owner_id uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  organization_id uuid references organizations (id) on delete set null,
  owner_id uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

-- Pipelines ---------------------------------------------------------------

create table pipelines (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  is_default boolean not null default false
);

create table pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  pipeline_id uuid not null references pipelines (id) on delete cascade,
  name text not null,
  order_index int not null,
  rotting_days int
);

-- Negócios (núcleo do CRM) -------------------------------------------------

create table deals (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  value numeric(14, 2) not null default 0,
  currency text not null default 'BRL',
  pipeline_id uuid not null references pipelines (id),
  stage_id uuid not null references pipeline_stages (id),
  contact_id uuid references contacts (id) on delete set null,
  organization_id uuid references organizations (id) on delete set null,
  owner_id uuid not null references profiles (id),
  status deal_status not null default 'open',
  expected_close_date date,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger deals_set_updated_at
  before update on deals
  for each row execute procedure public.set_updated_at();

-- Leads não qualificados ----------------------------------------------------

create table leads (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_info text,
  source text,
  status lead_status not null default 'new',
  converted_deal_id uuid references deals (id) on delete set null,
  owner_id uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

-- Atividades ------------------------------------------------------------

create table activities (
  id uuid primary key default gen_random_uuid(),
  type activity_type not null,
  subject text not null,
  due_date timestamptz,
  done boolean not null default false,
  deal_id uuid references deals (id) on delete cascade,
  contact_id uuid references contacts (id) on delete cascade,
  owner_id uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

-- Notas (mentioned_user_ids alimenta notificações de menção) --------------

create table notes (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  deal_id uuid references deals (id) on delete cascade,
  contact_id uuid references contacts (id) on delete cascade,
  mentioned_user_ids uuid[],
  author_id uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

-- Campos customizados por tipo de registro --------------------------------

create table custom_fields (
  id uuid primary key default gen_random_uuid(),
  entity_type entity_type not null,
  label text not null,
  field_type custom_field_type not null,
  options_json jsonb,
  required boolean not null default false,
  order_index int not null default 0
);

create table custom_field_values (
  id uuid primary key default gen_random_uuid(),
  custom_field_id uuid not null references custom_fields (id) on delete cascade,
  entity_type entity_type not null,
  entity_id uuid not null,
  value text
);

create index custom_field_values_entity_idx
  on custom_field_values (entity_type, entity_id);

-- Arquivos anexados (metadados; binário no Supabase Storage) --------------

create table attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type entity_type not null,
  entity_id uuid not null,
  file_name text not null,
  storage_path text not null,
  size_bytes bigint not null default 0,
  uploaded_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create index attachments_entity_idx on attachments (entity_type, entity_id);

-- Log de auditoria (timeline automática da aba "Histórico") --------------

create table deal_stage_history (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals (id) on delete cascade,
  from_stage_id uuid references pipeline_stages (id),
  to_stage_id uuid not null references pipeline_stages (id),
  changed_by uuid not null references profiles (id),
  changed_at timestamptz not null default now()
);

-- Notificações (sino de notificações; realtime) ---------------------------

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  type notification_type not null,
  entity_type entity_type,
  entity_id uuid,
  message text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- Automações --------------------------------------------------------------

create table automation_rules (
  id uuid primary key default gen_random_uuid(),
  trigger_event trigger_event not null,
  conditions_json jsonb not null default '{}'::jsonb,
  actions_json jsonb not null default '[]'::jsonb,
  active boolean not null default true
);

-- Índices de apoio para as consultas mais comuns da aplicação -------------

create index deals_owner_idx on deals (owner_id);
create index deals_stage_idx on deals (stage_id);
create index deals_status_idx on deals (status);
create index contacts_owner_idx on contacts (owner_id);
create index organizations_owner_idx on organizations (owner_id);
create index activities_owner_idx on activities (owner_id);
create index activities_deal_idx on activities (deal_id);
create index notifications_user_unread_idx on notifications (user_id, read);
