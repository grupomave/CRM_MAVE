# Contexto
Estamos evoluindo o CRM MAVE (produção: https://crm-mave.vercel.app/dashboard).
Este ciclo tem 5 frentes: UI/UX do Kanban, exportação para Excel, download de anexos,
reorganização de colunas/pipelines nas Configurações e movimentação de negócios entre funis.

# Passo 0 — Reconhecimento (obrigatório antes de codar)
1. Analise o repositório e me informe: framework e versão, biblioteca de UI/estilo,
   biblioteca de drag-and-drop já usada no Kanban, banco/ORM, storage dos anexos,
   estrutura das tabelas envolvidas (pipelines, etapas/colunas, negócios, leads,
   organizações, anexos) e como os filtros das listagens são aplicados hoje.
2. Reaproveite as bibliotecas já instaladas sempre que possível. Só adicione dependência
   nova se for necessário, e justifique.
3. Apresente um plano por fases (abaixo), com arquivos que serão criados/alterados e
   eventuais migrations. AGUARDE minha aprovação antes de implementar.
4. Ao final de cada fase: rode build/lint/type-check, faça um commit separado com
   mensagem descritiva e me passe um resumo do que mudou e como testar.

# Fase Base — Refinamento visual global (executar antes da Fase 1)
Objetivo: deixar o CRM com aparência profissional, sóbria e elegante, consistente em
todas as telas, sem alterar regras de negócio.

## 1. Auditoria e design system
- Faça um levantamento das telas atuais e liste as inconsistências visuais (cores,
  espaçamentos, tamanhos de fonte, botões, bordas, sombras, ícones diferentes para a
  mesma ação).
- Centralize tokens de design (CSS variables / tema da lib de UI): cores, tipografia,
  espaçamentos, raios de borda, sombras e transições. Nenhum componente deve usar
  valores "soltos" (hex ou px avulsos) após esta fase.
- Crie/padronize componentes reutilizáveis: Button (primário, secundário, ghost,
  destrutivo), Input, Select, Badge, Avatar, Card, Modal, Dropdown, Tabs, Tooltip,
  Table, EmptyState, Skeleton, PageHeader.

## 2. Paleta e tipografia
- Paleta neutra (cinzas frios) como base, UMA cor primária de marca (baseada na
  identidade do Grupo Mave, pergunte-me se não encontrar no projeto) e cores
  semânticas discretas: sucesso, alerta, erro, informação.
- Evitar excesso de cores e gradientes; fundo levemente off-white, superfícies brancas,
  bordas finas e sombras sutis.
- Fonte moderna e legível (ex.: Inter ou Geist), escala tipográfica definida
  (títulos, subtítulos, corpo, legenda), pesos consistentes e números tabulares
  (`font-variant-numeric: tabular-nums`) em valores monetários e tabelas.
- Contraste mínimo WCAG AA em todos os textos.
- Implementar modo escuro usando os mesmos tokens, com alternador no menu do usuário
  (preferência salva; padrão segue o sistema operacional).

## 3. Layout e navegação
- Sidebar limpa e recolhível (modo só ícones), com ícones de um único pacote,
  item ativo bem destacado e agrupamento lógico dos menus.
- Header com breadcrumbs, título da página e ações principais alinhadas à direita
  (componente PageHeader padrão em todas as telas).
- Busca global / paleta de comandos com atalho Ctrl+K (buscar negócios, leads,
  organizações e navegar entre páginas).
- Grid de espaçamento em múltiplos de 4/8px e largura máxima de conteúdo nas telas
  de formulário e detalhe.

## 4. Tabelas e listagens (Leads, Organizações, Negócios)
- Cabeçalho fixo, linhas com altura confortável, hover sutil, ações da linha
  aparecendo no hover/menu "⋯", colunas alinhadas (números à direita).
- Status como badges coloridos discretos; responsáveis com avatar/iniciais.
- Barra de filtros organizada, com filtros ativos exibidos como "chips" removíveis
  e botão "Limpar filtros".
- Seleção múltipla com barra de ações em massa que aparece ao selecionar.
- Paginação clara com total de registros.

## 5. Formulários e telas de detalhe
- Labels acima dos campos, placeholders úteis, campos obrigatórios sinalizados,
  validação inline com mensagem clara.
- Máscaras brasileiras: CNPJ, CPF, telefone, CEP, moeda (R$) e datas dd/mm/aaaa.
- Tela de detalhe do negócio organizada em duas colunas: informações principais à
  esquerda e timeline/atividades/anexos à direita (empilhando no mobile).

## 6. Estados e feedback
- Skeleton loading no lugar de spinners genéricos.
- Estados vazios com ícone/ilustração leve, texto explicativo e botão de ação
  (ex.: "Nenhum negócio nesta etapa — Criar negócio").
- Toasts padronizados para sucesso/erro, confirmações elegantes para ações
  destrutivas, páginas de erro (404/500) com o visual do sistema.

## 7. Microinterações
- Transições curtas (150–200ms) em hover, abertura de modais, dropdowns e
  drag-and-drop; respeitar `prefers-reduced-motion`.
- Feedback visual claro ao arrastar cards (sombra elevada, placeholder na posição
  de destino, destaque da coluna alvo).

## 8. Dashboard e login
- Dashboard com cards de KPI padronizados (valor, variação, período) e gráficos com
  a paleta do sistema, legendas legíveis e tooltips formatados em pt-BR.
- Tela de login refinada com logo, layout centralizado e visual coerente com o
  sistema. Conferir favicon e título das abas.

## Entrega desta fase
- Aplicar o novo padrão em TODAS as telas existentes, não só nas novas.
- Listar o que foi alterado por tela e as decisões de design tomadas (paleta, fonte,
  tokens), para mantermos o padrão nas próximas evoluções.
- Registrar essas diretrizes no CLAUDE.md do projeto (seção "Padrões de UI"), para
  que futuras alterações sigam o mesmo design system.

# Fase 1 — Kanban de Negócios (UI/UX e responsividade)
- Cards mais compactos: reduzir padding, fonte e altura; exibir só o essencial
  (título, organização, valor em R$, responsável com avatar/iniciais, data/indicador
  de atraso, tags). Detalhes ficam no hover/tooltip ou ao abrir o negócio.
- Alternador de densidade "Compacto / Confortável", com a preferência salva por usuário.
- Colunas com largura fixa menor, scroll horizontal suave no quadro e scroll vertical
  independente por coluna; cabeçalho da coluna fixo (sticky) mostrando nome, quantidade
  de negócios e soma dos valores.
- Permitir recolher/expandir colunas.
- Mobile/tablet: layout utilizável (ex.: uma coluna por vez com seletor de etapa ou
  swipe), sem quebra de layout. Testar em 375px, 768px, 1280px e 1920px.
- Performance: se houver muitas cards por coluna, usar paginação/"carregar mais" ou
  virtualização.
- Manter acessibilidade (foco visível, drag-and-drop com teclado se a lib suportar)
  e o padrão visual atual do sistema.

# Fase 2 — Exportação para Excel (Leads, Organizações e Negócios)
- Botão "Exportar Excel" nas três listagens (e no Kanban de Negócios).
- A exportação deve respeitar EXATAMENTE os filtros, busca e ordenação aplicados no
  momento, e trazer TODOS os registros filtrados (não apenas a página visível).
- Arquivo .xlsx com: cabeçalhos em português, linha de cabeçalho em negrito e congelada,
  autofiltro, largura de colunas ajustada, valores monetários em formato R$, datas em
  dd/mm/aaaa, campos relacionados resolvidos (nome da organização, responsável, pipeline,
  etapa) em vez de IDs.
- Nome do arquivo: `negocios_AAAA-MM-DD_HHmm.xlsx` (idem para leads/organizacoes).
- Respeitar as permissões do usuário: exportar somente o que ele pode ver.
- Para volumes grandes, gerar no servidor (rota/API) com streaming; mostrar
  indicador de carregamento e mensagem de erro amigável.

# Fase 3 — Anexos: download individual e em lote
- Download individual em cada anexo (mantendo nome original e extensão).
- Checkboxes para seleção múltipla + "Selecionar todos" + botão "Baixar selecionados"
  e "Baixar todos", gerando um .zip (ex.: `anexos_<nome-do-negocio>_AAAA-MM-DD.zip`).
- Tratar nomes de arquivo duplicados dentro do zip (sufixo numérico).
- Usar URLs assinadas/temporárias quando o storage for privado; nunca expor
  arquivos sem checar permissão.
- Aplicar onde houver anexos (negócios, leads, organizações).
- Mostrar progresso durante a geração do zip e limitar/avisar em lotes muito grandes.

# Fase 4 — Configurações: organizar colunas (etapas) dos pipelines por arrastar
- Na tela de Configurações > Pipelines, permitir reordenar as etapas por
  drag-and-drop. Os negócios continuam vinculados às suas etapas, então a nova ordem
  deve refletir imediatamente no Kanban, levando todos os cards juntos.
- Permitir arrastar uma etapa de um pipeline para outro. Nesse caso, se a etapa tiver
  negócios vinculados, abrir um modal de confirmação perguntando o que fazer:
  (a) mover a etapa junto com todos os negócios para o novo pipeline;
  (b) mover apenas a etapa e realocar os negócios para outra etapa do pipeline
      de origem (usuário escolhe qual);
  (c) cancelar.
  O modal deve mostrar a quantidade de negócios afetados e o valor total.
- Ao excluir uma etapa com negócios vinculados, exigir a escolha de uma etapa/pipeline
  de destino antes de excluir (nunca deixar negócios órfãos).
- Todas as operações em massa devem ser atômicas (transação/função no banco),
  com atualização otimista na UI e rollback em caso de erro.

# Fase 5 — Mover negócios entre funis (pipelines)
- No card do Kanban (menu de ações), na tela de detalhe do negócio e em ação em massa
  (seleção múltipla na lista/Kanban): opção "Mover para outro funil".
- Modal com seleção de pipeline de destino + etapa de destino (obrigatória).
- Registrar no histórico/timeline do negócio: de qual pipeline/etapa para qual,
  quem moveu e quando.
- Verificar e ajustar impactos em relatórios, dashboards, automações e contadores
  que dependam de pipeline/etapa.

# Requisitos gerais
- Todo texto de interface em português do Brasil.
- Não quebrar funcionalidades existentes; se encontrar algo que conflite com o que
  foi pedido, pare e me pergunte.
- Migrations reversíveis e seguras para dados existentes em produção.
- Respeitar as regras de permissão/segurança já existentes (inclusive RLS, se houver).
- Toasts de sucesso/erro e confirmação para ações destrutivas ou em massa.
- No final, entregue um checklist de testes manuais para eu validar cada fase.

# Agents de Revisão
- Crie um agent para revisar todo o material que foi solicitado
- Crie um agent para testar todas as funcionalidades após cada entrega