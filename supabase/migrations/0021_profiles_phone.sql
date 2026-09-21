-- Adiciona telefone ao cadastro de usuário (tela de Configurações >
-- Usuários e permissões). O e-mail já existe em auth.users; nome e papel
-- já existiam em profiles — só faltava telefone.

alter table profiles
  add column phone text;
