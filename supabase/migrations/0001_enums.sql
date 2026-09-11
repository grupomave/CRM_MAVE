-- Enums usados pelo schema do CRM Grupo Mave (ver prompt.md seção 4)

create type user_role as enum ('admin', 'gestor', 'vendedor');
create type entity_type as enum ('deal', 'contact', 'organization');
create type deal_status as enum ('open', 'won', 'lost');
create type lead_status as enum ('new', 'contacted', 'qualified', 'disqualified', 'converted');
create type activity_type as enum ('task', 'call', 'meeting', 'email');
create type custom_field_type as enum ('text', 'number', 'date', 'select', 'checkbox');
create type trigger_event as enum ('deal_stage_changed', 'deal_created', 'activity_overdue');
create type notification_type as enum ('mention', 'deal_assigned', 'activity_due', 'automation');
