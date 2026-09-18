-- Log de cliques no botão de WhatsApp (prompt.md seção 3.7) — o CRM não tem
-- acesso ao conteúdo da conversa (fora de escopo, exigiria a API oficial do
-- WhatsApp Business), só registra que o contato foi iniciado e por quem.

create table whatsapp_click_logs (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references contacts (id) on delete cascade,
  deal_id uuid references deals (id) on delete cascade,
  clicked_by uuid not null references profiles (id),
  clicked_at timestamptz not null default now()
);

create index whatsapp_click_logs_contact_id_idx on whatsapp_click_logs (contact_id);
create index whatsapp_click_logs_deal_id_idx on whatsapp_click_logs (deal_id);
create index whatsapp_click_logs_clicked_by_idx on whatsapp_click_logs (clicked_by);

alter table whatsapp_click_logs enable row level security;

-- Mesmo padrão "por dono do negócio/contato" — só quem já tem acesso ao
-- contato ou ao negócio relacionado pode ver/registrar o clique.
create policy "whatsapp_click_logs_select" on whatsapp_click_logs for select using (
  (contact_id is not null and exists (
    select 1 from contacts c where c.id = whatsapp_click_logs.contact_id and public.can_access_owner(c.owner_id)
  ))
  or (deal_id is not null and exists (
    select 1 from deals d where d.id = whatsapp_click_logs.deal_id and public.can_access_owner(d.owner_id)
  ))
);

create policy "whatsapp_click_logs_insert" on whatsapp_click_logs for insert
  with check (clicked_by = (select auth.uid()));
