-- Bucket de Storage para os anexos de negócios/contatos/organizações
-- (prompt.md seção 7). Privado — leitura via signed URL (ver
-- FilesTab em src/app/(dashboard)/deals/[id]/deal-detail-tabs.tsx).

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy "attachments_bucket_select" on storage.objects for select
  using (bucket_id = 'attachments' and auth.role() = 'authenticated');

create policy "attachments_bucket_insert" on storage.objects for insert
  with check (bucket_id = 'attachments' and auth.role() = 'authenticated');

create policy "attachments_bucket_delete_own" on storage.objects for delete
  using (bucket_id = 'attachments' and owner = auth.uid());
