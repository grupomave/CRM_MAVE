# Prompt de Desenvolvimento — CRM Grupo Mave (inspirado no Pipedrive)

> Cole este prompt inteiro em uma ferramenta de desenvolvimento assistido por IA (Claude Code, Cursor, v0, Lovable, Bolt etc.) para gerar o projeto. Ajuste os trechos marcados com `[[ ... ]]` antes de usar.

---

## 1. Objetivo

Desenvolver um **CRM web (SaaS interno)** para o **Grupo Mave**, replicando a **estrutura funcional, fluxo de navegação e lógica de UX do Pipedrive** (pipeline visual de negócios em Kanban, gestão de contatos/organizações, atividades, automações e relatórios), mas com **identidade visual própria do Grupo Mave** (logo, cores, tipografia da marca) no lugar da marca Pipedrive.

Não copiar textos, ícones proprietários, ilustrações ou código-fonte do Pipedrive — replicar apenas o **padrão de layout e comportamento** (estrutura de telas, tipos de componentes, fluxo de uso), que são padrões comuns de UX em ferramentas de CRM.

Referências de uso (apenas para entender o padrão de navegação, não para copiar visualmente):
- https://www.pipedrive.com/pt/
- https://pipedigital.com.br/tutoriais-pipedrive

---

## 2. Stack técnica obrigatória

- **Frontend:** Next.js 14+ (App Router) + React + TypeScript + Tailwind CSS
- **Componentes:** shadcn/ui como base, customizado com o design system do Grupo Mave (seção 5)
- **Backend / Banco de dados:** Supabase (Postgres + Auth + Row Level Security + Storage + Realtime)
- **Hospedagem:** Vercel (deploy contínuo via Git)
- **Autenticação:** Supabase Auth (e-mail/senha + opção de login corporativo via Microsoft 365, já que o Grupo Mave usa M365)
- **Drag-and-drop do Kanban:** `@dnd-kit` (suporte nativo a touch, essencial para o uso em smartphone/tablet — evitar `react-beautiful-dnd`, que está descontinuado e tem suporte fraco a toque)
- **Gráficos/relatórios:** `recharts`
- **Formulários:** `react-hook-form` + `zod`
- **Notificações em tempo real:** Supabase Realtime (mudanças de pipeline, novas atividades, menções)
- **Envio de e-mail transacional:** Resend, SendGrid ou API do Microsoft 365/Outlook via Edge Function do Supabase
- **Contato via WhatsApp:** links `wa.me` (click-to-chat), sem necessidade de biblioteca adicional
- **Importação de dados:** consumo da API REST do Pipedrive (`api.pipedrive.com/v1`) via Edge Function do Supabase + parser de CSV (`papaparse`) como alternativa

---

## 3. Estrutura de módulos (replicando a navegação do Pipedrive)

### 3.1 Barra lateral (sidebar fixa, ícones + labels)
1. **Dashboard** — visão geral (metas, atividades do dia, negócios parados, funil resumido)
2. **Negócios (Pipeline)** — visão Kanban por estágio, arrastar e soltar cards entre colunas
3. **Leads (Caixa de entrada de leads)** — leads não qualificados antes de virarem negócio
4. **Contatos**
   - Pessoas
   - Organizações/Empresas
5. **Atividades / Agenda** — lista + visão de calendário (reuniões, ligações, tarefas, e-mails)
6. **Documentos** — repositório central com busca, tags e controle de validade (ver seção 3.6)
7. **Automações** — regras "quando X acontece, faça Y" (ex.: negócio muda de estágio → cria tarefa)
8. **Relatórios / Insights** — funil de conversão, previsão de receita, desempenho por vendedor
9. **Configurações**
   - Usuários e permissões
   - Pipelines e estágios customizáveis
   - Campos customizados
   - Integrações (e-mail, WhatsApp, calendário)
   - Identidade visual (logo, cores — ver seção 5)

### 3.1.1 Múltiplos funis por vendedor e reatribuição dinâmica (gestão do gestor)

O sistema precisa suportar uma estrutura **muitos-para-um flexível**, não fixa:

- **Um vendedor pode ter vários funis simultaneamente** (ex.: um funil "Segurança Patrimonial", outro "Limpeza e Conservação", outro "BSC Corretora"), cada um com seus próprios estágios
- Cada funil tem um **responsável (`owner_id`)**, mas o dono pode ser trocado a qualquer momento sem perder o histórico do funil (negócios, atividades, propostas continuam vinculados)
- Um funil também pode ser marcado como **compartilhado/de equipe** (sem dono único), visível a todos os vendedores de um time

**Ações do gestor (papel `gestor`/`admin`), tudo via drag-and-drop ou seletor rápido, sem precisar editar registro por registro:**
1. **Reatribuir um funil inteiro para outro vendedor** — tela "Gerenciar Funis" lista todos os funis com Responsável, Nº de negócios e Valor total; ação "Transferir responsável" com dropdown de vendedor. Ao confirmar, **todos os negócios dentro do funil passam automaticamente a pertencer ao novo vendedor** (`deals.owner_id` é atualizado em lote); o vendedor original fica registrado apenas como **referência histórica** (campo `original_owner_id` em cada negócio + log de auditoria), sem manter acesso de edição sobre eles
2. **Mover um negócio individual para outro funil** — a partir do card no Kanban ou da ficha do negócio, ação "Mover para outro funil", com seletor de funil de destino + mapeamento do estágio equivalente (ex.: "Negociação" no funil de origem → "Negociação" no funil de destino, com opção de ajustar manualmente se os estágios não baterem)
3. **Mover vários negócios de uma vez** (bulk action) — selecionar múltiplos cards na visão de lista e aplicar "Mover para funil X" ou "Reatribuir para vendedor Y" em lote
4. **Reordenar/duplicar funis** — criar um novo funil a partir de um template existente (clonar estágios), útil quando abre uma nova linha de serviço

**Auditoria:**
- Toda reatribuição de funil ou negócio gera um registro de log (quem fez, quando, de quem para quem), visível na timeline do funil/negócio — importante para rastrear decisões comerciais e evitar disputa de carteira entre vendedores

### 3.2 Topo da tela (header global)
- Logo do Grupo Mave à esquerda (clicável → Dashboard)
- Busca global (atalho tipo `Cmd/Ctrl+K`)
- Botão "+" de criação rápida (novo negócio, contato, atividade)
- Sino de notificações
- Avatar do usuário com menu (perfil, tema claro/escuro, sair)

### 3.3 Tela de Pipeline (núcleo do sistema, estilo Kanban do Pipedrive)
- Colunas = estágios do funil (ex.: Novo Lead → Qualificação → Proposta Enviada → Negociação → Fechado Ganho / Fechado Perdido)
- Cada card mostra: nome do negócio, valor (R$), organização, próxima atividade agendada, avatar do responsável
- Drag-and-drop entre colunas atualiza o estágio no banco em tempo real
- Barra de progresso/valor total por coluna no topo de cada estágio
- Filtros: por responsável, por período, por valor, por origem do lead
- Alternância de visão: Kanban ↔ Lista ↔ Fluxo (forecast)
- Seletor de funil ativo no topo (já que um vendedor pode ter vários funis) + opção "ver todos os meus funis" em visão consolidada
- Ação rápida no card do negócio: "Mover para outro funil" (ver 3.1.1) — disponível para o próprio vendedor (seu negócio) e para o gestor (qualquer negócio da equipe)

### 3.4 Ficha de detalhe (negócio / contato / organização)
- Painel lateral ou tela dedicada com abas: **Visão geral**, **Atividades**, **E-mails**, **Notas**, **Arquivos**, **Histórico**
- Timeline cronológica de interações
- Campos customizáveis por tipo de registro
- Ícone de telefone/WhatsApp clicável ao lado do número de contato (ver seção 3.7)

### 3.5 Módulo de Propostas (acompanhamento dedicado)

Cada negócio pode ter uma ou mais propostas vinculadas, com controle completo do ciclo de vida:

- **Versionamento**: cada revisão da proposta é salva (v1, v2, v3...) com diff do que mudou (valor, escopo, condições) — nunca sobrescrever, sempre criar nova versão
- **Status granular**: Rascunho → Enviado → Visualizado pelo cliente → Em análise → Negociação → Aprovado / Recusado
- **Rastreamento de abertura**: link exclusivo/tracking pixel para saber se e quando o cliente abriu a proposta
- **Assinatura eletrônica**: integração com Autentique, Clicksign ou D4Sign; status refletido automaticamente no CRM
- **Follow-up automático por SLA**: regra configurável (ex.: "sem resposta em 3 dias úteis → notificar vendedor" ou lembrete automático ao cliente)
- **Validade com alerta de expiração**: campo de data de validade + notificação antes de vencer (relevante para reajustes de dissídio/CCT e reforma tributária)
- **Aprovação interna em etapas**: proposta acima de valor configurável exige aprovação do gestor antes do envio
- **Comparativo histórico**: ver propostas anteriores enviadas para o mesmo cliente/organização, evitando inconsistência de preço
- **Anexos vinculados**: planilha de formação de custos, contrato-modelo, apólice (relevante para BSC Corretora)
- **Métricas de proposta**: tempo médio até fechamento, taxa de aceite por vendedor/tipo de serviço, ticket médio
- **Vínculo com precificação**: campos de valor idealmente alimentados a partir de uma versão da planilha de formação de custos migrada para o Supabase, em vez de digitação manual

### 3.6 Arquivamento e repositório de documentos

- Repositório central de documentos por negócio/contato/organização (contratos, apólices, propostas, comprovantes, alvarás — ver [[alvara-checker]])
- Upload via drag-and-drop, com preview de PDF/imagem direto na tela
- Versionamento de documentos (assim como nas propostas), mantendo histórico de arquivos substituídos
- Categorização/tags (ex.: "Contrato", "Apólice", "Proposta", "Nota Fiscal", "Documentação Legal")
- Controle de expiração para documentos com validade (contratos, apólices, licenças) com alerta antes do vencimento
- Permissões por papel: definir quem pode ver/editar/excluir cada categoria de documento
- Armazenamento no Supabase Storage, com URLs assinadas (signed URLs) para acesso seguro e temporário
- Busca por nome, tag, negócio ou organização

### 3.7 Envio de e-mails e contato via WhatsApp

**Envio de e-mails direto do CRM:**
- Compor e enviar e-mail a partir da ficha do negócio/contato, sem sair do sistema
- Templates de e-mail reutilizáveis (proposta enviada, follow-up, boas-vindas, cobrança)
- Envio via API transacional (ex.: Resend, SendGrid ou integração com Microsoft 365/Outlook, já usado no Grupo Mave) a partir de uma Edge Function do Supabase
- Todo e-mail enviado fica registrado na timeline do negócio/contato (data, assunto, status de entrega/abertura)
- Confirmação de leitura (open tracking) quando suportado pelo provedor

**Clique para abrir WhatsApp (click-to-chat):**
- Ícone/botão de WhatsApp ao lado do telefone em cada contato
- Ao clicar, gerar um link no formato `https://wa.me/55<DDD><NUMERO>?text=<mensagem-opcional>` (número já formatado a partir do campo de telefone cadastrado)
- Comportamento por dispositivo:
  - **No desktop/PC**: abrir o **WhatsApp Web/Desktop** automaticamente (o link `wa.me` detecta se o WhatsApp Desktop está instalado e abre por lá; caso contrário, abre no navegador em `web.whatsapp.com`)
  - **No smartphone**: abrir diretamente o **app do WhatsApp** instalado (o link `wa.me` é reconhecido nativamente pelo iOS/Android)
- Implementar como link simples (`<a href="https://wa.me/..." target="_blank">`), sem necessidade de biblioteca extra — o próprio protocolo `wa.me` já resolve a detecção de plataforma
- Opcional: registrar na timeline do negócio/contato quando o botão de WhatsApp foi clicado (log de contato iniciado), já que o CRM não tem acesso ao conteúdo da conversa em si (isso exigiria a API oficial do WhatsApp Business, fora de escopo nesta fase — ver seção 9)

### 3.8 Módulo de Relatórios e Gráficos (Insights)

Tela dedicada com filtros globais no topo (período, funil, vendedor, equipe, tipo de serviço) que se aplicam a todos os gráficos abaixo. Organizar em abas/seções:

**A) Temperatura e saúde da carteira (frios x quentes)**
- **Gráfico de dispersão (scatter)**: negócios posicionados por "dias sem atividade" (eixo X) x "valor do negócio" (eixo Y), coloridos por temperatura — permite ver rapidamente negócios de alto valor esfriando
- **Cartões-resumo**: Nº de negócios "quentes" (atividade nos últimos 3 dias), "mornos" (4–10 dias) e "frios" (11+ dias sem interação) — thresholds configuráveis em Configurações
- **Lista priorizada de negócios frios de maior valor** — ação direta de "criar follow-up" a partir da lista
- **Gráfico de barras**: distribuição de negócios por faixa de tempo parado no estágio atual (`rotting_days`), por estágio

**B) Análise temporal (por tempo)**
- **Gráfico de linha**: evolução do valor total em negociação (pipeline) mês a mês
- **Gráfico de linha**: novos negócios criados x negócios fechados (ganhos/perdidos) por semana/mês
- **Tempo médio de ciclo de venda**: dias entre criação do negócio e fechamento, segmentado por funil e por vendedor (gráfico de barras horizontal)
- **Gráfico de barras empilhadas**: quantidade de negócios por estágio ao longo do tempo (evolução do funil período a período)
- **Sazonalidade**: comparação do mesmo período em anos/meses anteriores (ano atual x ano anterior)

**C) Vendas e desempenho comercial**
- **Funil de conversão (funnel chart)**: taxa de passagem de negócios entre estágios, identificando o "gargalo" do funil
- **Ranking de vendedores**: valor fechado, nº de negócios ganhos, ticket médio, taxa de conversão (tabela ordenável + gráfico de barras)
- **Meta x Realizado**: gráfico de barras (ou gauge/velocímetro) por vendedor e por equipe, com projeção de fechamento do mês baseada no forecast ponderado por estágio
- **Receita por tipo de serviço/funil**: segurança x limpeza x portaria x BSC Corretora (gráfico de pizza/rosca ou barras)
- **Origem dos negócios ganhos**: indicação, site, prospecção ativa, licitação etc. (gráfico de pizza), cruzado com taxa de conversão por origem

**D) Perdas (motivos e padrões)**
- **Gráfico de barras**: motivos de perda padronizados (preço, prazo, concorrente, escopo, sem retorno do cliente etc.) — exige campo obrigatório de motivo ao marcar "Fechado Perdido"
- **Taxa de perda por estágio**: em qual etapa do funil mais se perde negócio
- **Perdas por vendedor e por funil**: identificar padrões (ex.: um funil específico perdendo mais para concorrência de preço)
- **Valor perdido acumulado** (R$) por período — quanto "ficou na mesa"
- **Negócios reabertos**: quantos negócios marcados como perdidos foram reativados depois (indicador de perda precipitada)

**E) Por gestor / equipe**
- **Visão consolidada por gestor**: soma de todos os vendedores da equipe dele, com drill-down por vendedor individual
- **Comparativo entre equipes**: desempenho de cada squad/regional lado a lado
- **Funis sob responsabilidade de cada gestor** e histórico de reatribuições (ligado à seção 3.1.1 — quantas vezes um funil/negócio mudou de mão)
- **Carga de trabalho por vendedor**: nº de negócios ativos, nº de atividades atrasadas — ajuda o gestor a balancear a carteira

**F) Propostas e documentos (complementando a seção 3.5)**
- **Taxa de aceite de propostas** por vendedor e por tipo de serviço
- **Tempo médio entre envio e resposta da proposta**
- **Propostas próximas do vencimento** (lista de ação, não só gráfico)
- **Funil de proposta**: Enviada → Visualizada → Assinada, com percentual de queda em cada etapa

**G) Atividades e produtividade**
- **Atividades realizadas x atrasadas** por vendedor (gráfico de barras)
- **Tipo de atividade mais realizada**: ligação, reunião, e-mail, WhatsApp (pizza)
- **Taxa de conclusão de tarefas automáticas** geradas pelas automações (seção 3.1's automações)

**Exportação e distribuição:**
- Exportar qualquer relatório em PDF ou CSV
- Relatório semanal/mensal automático por e-mail para gestores (usando o mesmo mecanismo de envio da seção 3.7)
- Cada gráfico com opção "salvar como favorito no Dashboard" (permite montar um dashboard personalizado por usuário)

### 3.9 Importação e migração de dados do Pipedrive

Ferramenta dedicada (tela em Configurações → "Importar do Pipedrive") para trazer a base histórica sem perder dados, usada uma única vez (ou em lotes) durante a transição:

**Método de importação (dois caminhos, suportar ambos):**
1. **Via API do Pipedrive** (preferencial) — usuário informa a API Key do Pipedrive; o sistema busca os dados diretamente pelos endpoints REST (`/deals`, `/persons`, `/organizations`, `/activities`, `/notes`, `/pipelines`, `/stages`, `/users`, `/files`)
2. **Via exportação CSV** (fallback) — upload dos arquivos CSV exportados manualmente do Pipedrive (Configurações → Dados → Exportar), para quando o plano do Pipedrive não permite acesso à API ou a chave já foi cancelada

**Etapas do processo de migração:**
1. **Conexão/upload** — inserir API Key ou subir os CSVs
2. **Mapeamento de campos** — tela mostrando os campos do Pipedrive de um lado e os campos do CRM do outro, com sugestão automática de correspondência (ex.: `deal.title` → `deals.title`, `person.email` → `contacts.email`), incluindo **campos customizados** do Pipedrive que precisam virar campos customizados no novo CRM
3. **Mapeamento de usuários** — associar cada usuário/vendedor do Pipedrive a um `profile` já existente no CRM novo (ou criar convite de acesso para quem ainda não tem conta)
4. **Mapeamento de pipelines e estágios** — decidir se recria a mesma estrutura de funis/estágios do Pipedrive ou associa a funis já existentes no CRM novo
5. **Pré-visualização (dry-run)** — mostrar amostra dos dados como ficariam após a importação, com contagem total por entidade (ex.: "1.240 negócios, 3.500 contatos, 890 organizações, 6.200 atividades") antes de confirmar
6. **Execução da importação** — processo em background (fila/edge function), com barra de progresso e possibilidade de rodar em lotes para volumes grandes
7. **Relatório de importação** — ao final, lista de registros importados com sucesso e registros com erro/pendência (ex.: e-mail duplicado, campo obrigatório vazio), permitindo corrigir e reimportar apenas os que falharam

**Regras de integridade:**
- Detecção de duplicidade por e-mail (contatos) e CNPJ (organizações) antes de criar novo registro — oferecer opção de mesclar com registro já existente
- Preservar `created_at` original do Pipedrive (não usar a data da importação), para manter o histórico real do funil e das métricas de tempo de ciclo (seção 3.8-B)
- Anexos/arquivos do Pipedrive baixados e reenviados para o Supabase Storage, mantendo o vínculo com o negócio/contato correspondente
- Notas e histórico de e-mails importados como registros somente leitura na timeline, sinalizados como "Importado do Pipedrive" para diferenciar de dados nativos do novo CRM
- Log completo da migração (`import_logs`) para auditoria — quem rodou, quando, quantos registros, taxa de erro

### 3.10 Uso em smartphone (responsivo / PWA — sem app nativo)

O CRM deve funcionar plenamente pelo navegador do celular, com a mesma URL da versão web (não é um app separado — ver ressalva no escopo, seção 9). Pontos que **exigem adaptação específica**, não apenas "responsividade automática" do Tailwind:

**Navegação:**
- Sidebar lateral (3.1) vira **menu inferior fixo (bottom navigation)** ou **menu hambúrguer** em telas pequenas, com os itens mais usados (Pipeline, Atividades, Contatos, "+" de criação rápida) sempre visíveis
- Header (3.2) simplificado: busca e notificações colapsam em ícones, avatar em menu

**Tela de Pipeline (a mais crítica em mobile):**
- Kanban com colunas lado a lado **não funciona bem em tela de celular** — usar visão de **lista por estágio com abas/swipe horizontal** entre estágios, em vez de rolagem horizontal de colunas
- Ação de mudar o estágio do negócio via **menu de contexto/botão "Mover para →"** como alternativa ao arrastar (drag-and-drop com o dedo funciona, mas deve sempre ter uma alternativa por toque simples, mais confiável em telas pequenas)
- Cards do negócio com informação condensada (nome, valor, próxima atividade) e toque para expandir detalhe completo

**Funcionalidades que ganham mais valor no celular (priorizar):**
- **Botão de WhatsApp e telefone** (seção 3.7) — já nativo em mobile, é onde mais se usa
- **Upload de documentos direto da câmera** (seção 3.6) — permitir fotografar contrato/comprovante em campo e anexar na hora
- **Check-in de visita com geolocalização** — ao registrar uma atividade do tipo "visita ao cliente", capturar localização do smartphone automaticamente (relevante pro Grupo Mave, que tem equipe visitando postos/clientes fisicamente)
- **Notificações push (Web Push API)** — lembrete de atividade, proposta visualizada pelo cliente, negócio esfriando
- **Criação rápida de negócio/atividade/nota** otimizada para poucos toques, sem formulários longos

**PWA (Progressive Web App) — recomendado em vez de app nativo:**
- `manifest.json` com ícone e cores do Grupo Mave, permitindo "Adicionar à tela inicial" tanto no Android quanto no iOS
- Service worker básico para cache de assets estáticos e leitura offline dos últimos dados carregados (sem exigir sincronização offline completa nesta fase)
- Login persistente (sessão longa) para não pedir autenticação toda vez que o vendedor abre pelo celular

**Testar prioritariamente em:** Chrome Android e Safari iOS (são os navegadores reais de uso, diferente do Chrome desktop redimensionado).

---

## 4. Modelo de dados sugerido (Supabase / Postgres)

```sql
-- Empresas/Organizações
organizations (id, name, cnpj, address, sector, owner_id, created_at)

-- Pessoas de contato
contacts (id, name, email, phone, organization_id, owner_id, created_at)

-- Pipelines customizáveis (um vendedor pode ter vários; dono pode ser trocado)
pipelines (id, name, is_default, owner_id, visibility, team_id,
           cloned_from_pipeline_id, created_at)
pipeline_stages (id, pipeline_id, name, order_index, rotting_days)

-- Auditoria de reatribuição de funis e negócios entre vendedores/funis
pipeline_reassignment_logs (id, pipeline_id, previous_owner_id, new_owner_id,
                             reassigned_by, reassigned_at)
deal_transfer_logs (id, deal_id, previous_pipeline_id, new_pipeline_id,
                     previous_owner_id, new_owner_id, transferred_by,
                     transferred_at)

-- Negócios (o coração do CRM)
-- original_owner_id: preenchido automaticamente na primeira transferência,
-- mantém apenas a menção de quem era o vendedor original (não editável depois)
-- lost_reason: obrigatório quando status = 'perdido', alimenta relatórios de perda
-- last_activity_at: atualizado a cada interação, base do cálculo de temperatura
deals (id, title, value, currency, pipeline_id, stage_id, contact_id,
       organization_id, owner_id, original_owner_id, status,
       lost_reason, last_activity_at, expected_close_date,
       source, created_at, updated_at)

-- Metas comerciais (para os relatórios de Meta x Realizado)
sales_targets (id, owner_id, team_id, period_start, period_end,
               target_value, created_at)

-- Importação/migração de dados do Pipedrive
import_jobs (id, source, status, started_by, started_at, finished_at,
             total_records, imported_records, failed_records)
import_field_mappings (id, import_job_id, source_field, target_field,
                        entity_type)
import_errors (id, import_job_id, entity_type, source_record_id,
               error_message, raw_data_json)

-- Leads não qualificados
leads (id, name, contact_info, source, status, converted_deal_id, created_at)

-- Atividades (tarefas, ligações, reuniões, e-mails)
-- latitude/longitude: preenchidos automaticamente em atividades do tipo "visita",
-- capturados via geolocalização do smartphone (ver seção 3.10)
activities (id, type, subject, due_date, done, deal_id, contact_id,
            owner_id, latitude, longitude, created_at)

-- Notas e histórico
notes (id, content, deal_id, contact_id, author_id, created_at)

-- Propostas (uma ou mais por negócio, com versionamento)
proposals (id, deal_id, current_version_id, status, valid_until,
           requires_approval, approved_by, approved_at, created_at)

proposal_versions (id, proposal_id, version_number, value, scope_json,
                    conditions, file_url, created_by, created_at)

-- Rastreamento de visualização da proposta pelo cliente
proposal_views (id, proposal_version_id, viewed_at, ip_address, user_agent)

-- Assinatura eletrônica
proposal_signatures (id, proposal_version_id, provider, external_id,
                      status, signed_at)

-- Documentos (repositório geral, além das propostas)
documents (id, deal_id, contact_id, organization_id, category, file_url,
           version_number, expires_at, uploaded_by, created_at)

-- Log de e-mails enviados
email_logs (id, deal_id, contact_id, template_id, subject, sent_at,
            opened_at, status, sent_by)

email_templates (id, name, subject, body_html, category)

-- Log de cliques no botão de WhatsApp (sem acesso ao conteúdo da conversa)
whatsapp_click_logs (id, contact_id, deal_id, clicked_by, clicked_at)

-- Automações
automation_rules (id, trigger_event, conditions_json, actions_json, active)

-- Usuários e permissões (referenciam auth.users do Supabase)
profiles (id references auth.users, full_name, role, team_id, avatar_url)
teams (id, name, manager_id)
```

Habilitar **Row Level Security (RLS)** em todas as tabelas: cada usuário só vê/edita os registros da própria equipe, exceto administradores (papel `admin`).

---

## 5. Identidade visual (substituindo a marca Pipedrive pela do Grupo Mave)

> ⚠️ Não consegui acessar automaticamente **grupomave.com.br** para extrair o logo e os códigos de cor exatos. Antes de gerar a interface, informe (ou peça para a ferramenta de IA usar como placeholders até você substituir):
> - Arquivo do logo (SVG/PNG, fundo transparente, versão colorida e versão monocromática branca)
> - Cor primária da marca (hex)
> - Cor secundária/de destaque (hex)
> - Fonte institucional, se houver (ou usar `Inter`/`Manrope` como padrão neutro)

Estrutura de tema sugerida (ajustar hex reais do Grupo Mave):

```css
:root {
  --brand-primary: #[[HEX_PRIMARIA_GRUPOMAVE]];
  --brand-primary-hover: #[[HEX_PRIMARIA_ESCURA]];
  --brand-secondary: #[[HEX_SECUNDARIA_GRUPOMAVE]];
  --brand-success: #1FB37A;   /* fechado ganho */
  --brand-danger: #E5484D;    /* fechado perdido */
  --brand-neutral-bg: #F7F8FA;
  --brand-sidebar-bg: #FFFFFF;
  --brand-text: #1C1F23;
  --brand-font: 'Inter', sans-serif;
}
```

Diretrizes de aplicação:
- Sidebar com o logo do Grupo Mave no topo (light/dark mode)
- Cor primária da marca nos botões de ação principal, nos indicadores de estágio ativo do pipeline e nos links
- Favicon e título da aba do navegador com o nome "Grupo Mave CRM"
- Tela de login com o logo centralizado sobre a cor de fundo institucional

---

## 6. Autenticação e permissões

- Login via Supabase Auth (e-mail corporativo `@grupomave.com.br`)
- Papéis: `admin`, `gestor`, `vendedor`
  - `admin`: acesso total, configura pipelines e automações
  - `gestor`: vê negócios da própria equipe, gera relatórios, **reatribui funis inteiros para outros vendedores e move/reatribui negócios entre funis (individualmente ou em lote)** — ver seção 3.1.1
  - `vendedor`: vê e edita apenas seus próprios negócios/contatos e funis dos quais é responsável; pode mover seus próprios negócios entre os funis que ele mesmo possui, mas não reatribuir para outro vendedor
- Políticas RLS no Supabase refletindo essa hierarquia, incluindo permissão de `UPDATE` em `pipelines.owner_id` e `deals.owner_id`/`deals.pipeline_id` restrita a `gestor`/`admin` (ou ao próprio vendedor quando o destino ainda é dele mesmo)

---

## 7. Requisitos de deploy (Vercel + Supabase)

- Repositório Git conectado à Vercel com deploy automático a cada push na branch principal
- Variáveis de ambiente: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (apenas em rotas server-side/edge functions)
- Ambientes separados: Preview (branches) e Production (main)
- Supabase Storage para armazenar arquivos anexados a negócios/contatos e o logo institucional

---

## 8. Entregáveis esperados da ferramenta de IA

1. Estrutura de pastas do projeto Next.js
2. Schema SQL completo com RLS para Supabase (migrations)
3. Telas: Login, Dashboard, Pipeline (Kanban), Contatos, Leads, Atividades/Agenda, Propostas, Documentos, Relatórios (ver 3.8), Importação do Pipedrive (ver 3.9), Configurações — todas responsivas, com adaptações mobile específicas (ver 3.10)
4. Componentes reutilizáveis de card de negócio, modal de criação rápida, timeline de atividades, timeline de versões de proposta, uploader de documentos, botão de contato WhatsApp/e-mail, biblioteca de gráficos reutilizáveis (linha, barra, pizza, funil, dispersão, gauge), wizard de mapeamento de campos para importação
5. Tema visual aplicando a identidade do Grupo Mave (seção 5)
6. Instruções de deploy na Vercel conectado ao Supabase
7. Configuração de PWA (manifest.json + service worker) para instalação na tela inicial do smartphone

---

## 9. Fora de escopo nesta primeira versão

- Integração completa de e-mail (IMAP/SMTP) — deixar estrutura pronta, mas não implementar nesta fase
- App mobile nativo (iOS/Android, publicado em loja) — o uso em smartphone é coberto via **web responsivo + PWA** (seção 3.10), o que já cobre a necessidade sem o custo de manter dois códigos-fonte separados
- Telefonia integrada (VoIP)
- Integração de assinatura eletrônica em produção (deixar schema e status prontos; conectar provedor real em fase 2)
- API oficial do WhatsApp Business (envio/recebimento de mensagens dentro do CRM) — nesta fase, apenas o link `wa.me` de abertura rápida do app
