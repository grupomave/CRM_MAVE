-- Módulo de Propostas (prompt.md seção 3.5). Cada negócio pode ter várias
-- propostas; cada proposta tem versões (nunca sobrescreve — sempre cria uma
-- nova versão). Assinatura eletrônica e tracking pixel ficam fora desta fase
-- (prompt.md seção 9: "deixar schema e status prontos" é para fase 2 —
-- aqui só o essencial: versionamento, status e aprovação interna manual).

create type proposal_status as enum (
  'draft',
  'sent',
  'viewed',
  'in_review',
  'negotiation',
  'approved',
  'rejected'
);

create table proposals (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals (id) on delete cascade,
  status proposal_status not null default 'draft',
  valid_until date,
  requires_approval boolean not null default false,
  approved_by uuid references profiles (id),
  approved_at timestamptz,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

create table proposal_versions (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references proposals (id) on delete cascade,
  version_number int not null,
  value numeric(14, 2) not null default 0,
  scope text,
  conditions text,
  file_name text,
  storage_path text,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now()
);

alter table proposals
  add column current_version_id uuid references proposal_versions (id);

create index proposals_deal_id_idx on proposals (deal_id);
create index proposals_created_by_idx on proposals (created_by);
create index proposals_approved_by_idx on proposals (approved_by);
create index proposal_versions_proposal_id_idx on proposal_versions (proposal_id);
create index proposal_versions_created_by_idx on proposal_versions (created_by);

alter table proposals enable row level security;
alter table proposal_versions enable row level security;

-- Mesmo padrão de visibilidade "por dono do negócio" já usado em
-- deal_stage_history / deal_status_history.
create policy "proposals_access" on proposals for all
  using (
    exists (
      select 1 from deals d
      where d.id = proposals.deal_id and public.can_access_owner(d.owner_id)
    )
  )
  with check (
    exists (
      select 1 from deals d
      where d.id = proposals.deal_id and public.can_access_owner(d.owner_id)
    )
  );

create policy "proposal_versions_access" on proposal_versions for all
  using (
    exists (
      select 1 from proposals p
      join deals d on d.id = p.deal_id
      where p.id = proposal_versions.proposal_id and public.can_access_owner(d.owner_id)
    )
  )
  with check (
    exists (
      select 1 from proposals p
      join deals d on d.id = p.deal_id
      where p.id = proposal_versions.proposal_id and public.can_access_owner(d.owner_id)
    )
  );
