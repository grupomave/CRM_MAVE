-- Campos que faltavam no schema para cobrir docx "Estrutura Pipedrive" e
-- para receber a base real do Pipedrive (ver docs/BACKUP PIPEDRIVE).

create type lost_reason as enum (
  'sem_retorno',
  'preco',
  'concorrente',
  'sem_interesse',
  'contratacao_adiada',
  'fora_perfil',
  'dados_incorretos',
  'outro'
);

-- deals ---------------------------------------------------------------------

alter table deals
  add column lost_reason lost_reason,
  add column original_owner_id uuid references profiles (id),
  add column last_activity_at timestamptz,
  add column frozen_at timestamptz;

-- organizations ---------------------------------------------------------------

alter table organizations
  add column legal_name text,
  add column company_size text,
  add column nature text check (nature in ('publica', 'privada')),
  add column city text,
  add column state text,
  add column website text,
  add column linkedin_url text,
  add column instagram_url text,
  add column phone text,
  add column services_of_interest text,
  add column notes text;

-- contacts --------------------------------------------------------------------

alter table contacts
  add column job_title text,
  add column whatsapp text,
  add column contact_preference text;

-- profiles ----------------------------------------------------------------

alter table profiles
  add column is_active boolean not null default true,
  add column must_change_password boolean not null default false;

-- deal_status_history: audita Ganho/Perdido/Reaberto, mesmo padrão de
-- deal_stage_history (auditoria de estágio) — status e estágio são
-- informações independentes (ver 0011_decouple_deal_status.sql).

create table deal_status_history (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals (id) on delete cascade,
  from_status deal_status not null,
  to_status deal_status not null,
  reason lost_reason,
  changed_by uuid not null references profiles (id),
  changed_at timestamptz not null default now()
);

create index deal_status_history_deal_id_idx on deal_status_history (deal_id);
create index deal_status_history_changed_by_idx on deal_status_history (changed_by);

alter table deal_status_history enable row level security;

create policy "deal_status_history_select" on deal_status_history for select using (
  exists (
    select 1 from deals d
    where d.id = deal_status_history.deal_id
      and public.can_access_owner(d.owner_id)
  )
);

create policy "deal_status_history_insert" on deal_status_history for insert
  with check (changed_by = auth.uid());
