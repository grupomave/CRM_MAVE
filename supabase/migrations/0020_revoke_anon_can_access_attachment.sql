-- O Supabase Advisor (rodado logo após aplicar 0018) apontou que
-- can_access_attachment ainda era executável pelo role "anon" via RPC
-- (/rest/v1/rpc/can_access_attachment), mesmo com "revoke ... from public"
-- na 0018 — igual ao problema que a 0009 já documentou: revogar de
-- "public" não remove um grant direto que o Supabase concede a "anon" na
-- criação da função. Revoga explicitamente de "anon" também, mesmo
-- padrão de is_admin/current_role/current_team_id/can_access_owner
-- (0008/0009).

revoke execute on function public.can_access_attachment(entity_type, uuid) from anon;
