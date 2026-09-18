/**
 * Importação one-off da base real do Pipedrive (docs/BACKUP PIPEDRIVE - 11.09.2026.xlsx)
 * para o CRM Grupo Mave. JÁ EXECUTADO em 14/09/2026 — mantido só como registro
 * de como a migração foi feita (nomes/e-mails, funis, normalização de etapas).
 *
 * `scripts/` está excluído do tsconfig e as libs `xlsx`/`tsx` foram removidas
 * do projeto depois da execução (eram só para este script). Para rodar de
 * novo: `npm install --save-dev xlsx tsx`, remover "scripts" do
 * tsconfig.json "exclude", então:
 *   npx tsx scripts/import-pipedrive.ts
 *
 * Lê SUPABASE_SERVICE_ROLE_KEY e NEXT_PUBLIC_SUPABASE_URL de .env.local.
 * NÃO é reaproveitável como importador genérico — os nomes de funil/etapa e
 * o mapeamento de proprietários abaixo são específicos desta planilha.
 *
 * Segurança de reexecução: o script aborta antes de importar negócios se a
 * tabela `deals` já não estiver vazia (evita duplicar em caso de reexecução
 * acidental). Usuários/organizações/contatos são "upsert por existência"
 * (pula quem já existe por e-mail / nome+cidade), então essas etapas podem
 * ser reexecutadas com segurança.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Carrega .env.local manualmente (script standalone, fora do Next.js)
// ---------------------------------------------------------------------------

function loadEnvLocal() {
  const path = ".env.local";
  if (!existsSync(path)) {
    throw new Error(".env.local não encontrado na raiz do projeto.");
  }
  for (const line of readFileSync(path, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar em .env.local",
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Configuração específica desta importação
// ---------------------------------------------------------------------------

const XLSX_PATH = "docs/BACKUP PIPEDRIVE - 11.09.2026.xlsx";
const TEMP_PASSWORD = "Mave123@";

type Role = "admin" | "gestor" | "vendedor";

interface OwnerDef {
  email: string;
  fullName: string;
  role: Role;
}

// Nome como aparece na coluna "Proprietário" da planilha -> conta real.
const OWNER_MAP: Record<string, OwnerDef> = {
  "Domingo Viera": { email: "domingo.viera@grupomave.com.br", fullName: "Domingo Viera", role: "vendedor" },
  "José Geraldo": { email: "jose.geraldo@grupomave.com.br", fullName: "José Geraldo", role: "vendedor" },
  "Barbara Salles": { email: "barbara.salles@grupomave.com.br", fullName: "Barbara Salles", role: "gestor" },
  "Jaime Knoblich": { email: "jaime.knoblich@grupomave.com.br", fullName: "Jaime Knoblich", role: "vendedor" },
  "Tatiane Gama dos Anjos Rodrigues": { email: "tatiane.gama@grupomave.com.br", fullName: "Tatiane Gama dos Anjos Rodrigues", role: "vendedor" },
  "Amarílis": { email: "amarilis.mattos@grupomave.com.br", fullName: "Amarílis", role: "vendedor" },
  "Lucilene": { email: "lucilene@grupomave.com.br", fullName: "Lucilene", role: "vendedor" },
  "Sergio Duque Souza": { email: "sergio.souza@grupomave.com.br", fullName: "Sergio Duque Souza", role: "vendedor" },
  "Roberto Azevedo": { email: "roberto.azevedo@grupomave.com.br", fullName: "Roberto Azevedo", role: "vendedor" },
  "Fernando Pereira": { email: "fernando.pereira@grupomave.com.br", fullName: "Fernando Pereira", role: "vendedor" },
  "Natanael Junior": { email: "natanael.junior@grupomave.com.br", fullName: "Natanael Junior", role: "vendedor" },
  "Petra Anuska Van Amson": { email: "petra.amson@grupomave.com.br", fullName: "Petra Anuska Van Amson", role: "vendedor" },
  "Fabio Avila": { email: "fabio.avila@grupomave.com.br", fullName: "Fabio Avila", role: "vendedor" },
  "Carlins Ferraz dos Santos": { email: "cf@grupomave.com.br", fullName: "Carlins Ferraz dos Santos", role: "vendedor" },
  "BackOffice Comercial": { email: "backoffice.comercial@grupomave.com.br", fullName: "BackOffice Comercial", role: "gestor" },
};

// Marcos Junior não aparece como "Proprietário" de nenhum negócio na
// planilha, mas precisa existir como conta real (gestor do BackOffice).
const EXTRA_USERS: OwnerDef[] = [
  { email: "comercial2@grupomave.com.br", fullName: "Marcos Junior", role: "gestor" },
];

const TEAM_NAME = "Comercial Mave";
const TEAM_MANAGER_EMAIL = "barbara.salles@grupomave.com.br";

function normalizeStageName(raw: string): string {
  const trimmed = raw.trim();
  const withoutSuffix = trimmed.split(" | ")[0].trim();
  if (withoutSuffix === "Apresentacao") return "Apresentação";
  return withoutSuffix;
}

// Funis reais e suas etapas (ordem = ordem no Kanban), derivados da própria
// planilha (cruzamento Funil x Etapa) + docx "Estrutura Pipedrive" seção 2
// (que também lista "Revisão", sem negócios hoje mas mantida para uso futuro).
const PIPELINE_DEFS: { name: string; isDefault: boolean; stages: string[] }[] = [
  {
    name: "Vendas de Novos Contratos",
    isDefault: true,
    stages: [
      "Prospecção",
      "Apresentação",
      "Solicitação",
      "Elaboração",
      "Concluída",
      "Revisão",
      "Curto Prazo",
      "Médio Prazo",
      "Longo Prazo",
      "Aceite",
      "Congelado",
    ],
  },
  {
    name: "Clientes Ativos",
    isDefault: false,
    stages: ["Médio Prazo", "Entrega", "Elaboração", "Congelado", "Curto Prazo", "Fechado", "Longo Prazo"],
  },
  {
    name: "Primebid",
    isDefault: false,
    stages: ["Curto Prazo", "Médio Prazo", "Contato Realizado", "Novo Prospect", "Longo Prazo"],
  },
  {
    name: "Vendas Avulsas/Esporádicas",
    isDefault: false,
    stages: [
      "Curto Prazo",
      "Longo Prazo",
      "Negócio Fechado",
      "Entrega de Proposta",
      "Solicitação de Proposta",
      "Elaboração de Proposta",
      "Processo Perdido",
    ],
  },
];

// ---------------------------------------------------------------------------
// Leitura da planilha (por índice de coluna — há cabeçalhos duplicados como
// "Pessoa - Sobrenome" e "Site", então não dá pra usar sheet_to_json normal)
// ---------------------------------------------------------------------------

function colIndex(letters: string): number {
  let n = 0;
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

const COL = {
  title: colIndex("A"),
  value: colIndex("B"),
  expectedClose: colIndex("E"),
  owner: colIndex("G"),
  pipeline: colIndex("H"),
  createdAt: colIndex("I"),
  closedAt: colIndex("J"),
  status: colIndex("K"),
  stage: colIndex("L"),
  personWhatsapp: colIndex("M"),
  personJobTitle: colIndex("N"),
  personLastActivity: colIndex("AB"),
  personEmailWork: colIndex("AJ"),
  personEmailHome: colIndex("AK"),
  personEmailOther: colIndex("AL"),
  personPhoneWork: colIndex("AM"),
  personPhoneHome: colIndex("AN"),
  personPhoneMobile: colIndex("AO"),
  personPhoneOther: colIndex("AP"),
  personName: colIndex("AQ"),
  personId: colIndex("AR"),
  orgLinkedin: colIndex("BC"),
  orgWebsite1: colIndex("AT"),
  orgWebsite2: colIndex("BD"),
  orgAddress: colIndex("BF"),
  orgState: colIndex("BK"),
  orgCity: colIndex("BL"),
  orgEmployeeCount: colIndex("AZ"),
  orgCurrentProvider: colIndex("AW"),
  orgOrigin: colIndex("AX"),
  orgOwner: colIndex("CE"),
  orgName: colIndex("CF"),
  orgId: colIndex("CG"),
};

function cell(row: unknown[], idx: number): string {
  const v = row[idx];
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function parseDate(row: unknown[], idx: number): string | null {
  const raw = row[idx];
  if (!raw) return null;
  if (raw instanceof Date) return raw.toISOString();
  const s = String(raw).trim();
  return s || null;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

interface ImportError {
  row: number;
  reason: string;
  data: Record<string, string>;
}

async function main() {
  console.log(`Lendo ${XLSX_PATH}...`);
  const workbook = XLSX.readFile(XLSX_PATH, { cellDates: true });
  const sheet = workbook.Sheets["deal list"];
  if (!sheet) throw new Error('Aba "deal list" não encontrada na planilha.');

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true });
  const dataRows = rows.slice(1); // pula cabeçalho

  console.log(`${dataRows.length} linhas de negócio encontradas.`);

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  console.log("\n=== Confirmação antes de gravar no banco ===");
  console.log(`Senha temporária que será usada para todos os usuários novos: ${TEMP_PASSWORD}`);
  console.log(`Projeto Supabase: ${SUPABASE_URL}`);
  const answer = await rl.question('Digite "sim" para continuar: ');
  rl.close();
  if (answer.trim().toLowerCase() !== "sim") {
    console.log("Cancelado.");
    return;
  }

  const errors: ImportError[] = [];

  // 1) Admin de bootstrap (autor das notas "Importado do Pipedrive") --------
  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .limit(1)
    .single();
  if (!adminProfile) throw new Error("Nenhum admin encontrado no banco.");
  const adminId = adminProfile.id as string;

  // 2) Equipe "Comercial Mave" ----------------------------------------------
  let { data: team } = await supabase
    .from("teams")
    .select("id")
    .eq("name", TEAM_NAME)
    .maybeSingle();
  if (!team) {
    const { data: newTeam, error } = await supabase
      .from("teams")
      .insert({ name: TEAM_NAME })
      .select("id")
      .single();
    if (error) throw error;
    team = newTeam;
  }
  const teamId = team!.id as string;

  // 3) Usuários --------------------------------------------------------------
  console.log("\nCriando usuários...");
  const emailToProfileId = new Map<string, string>();
  const allOwnerDefs = [...Object.values(OWNER_MAP), ...EXTRA_USERS];
  const seenEmails = new Set<string>();

  for (const def of allOwnerDefs) {
    if (seenEmails.has(def.email)) continue;
    seenEmails.add(def.email);

    const { data: existing } = await supabase
      .from("profiles")
      .select("id, full_name")
      .ilike("full_name", def.fullName)
      .maybeSingle();

    if (existing) {
      emailToProfileId.set(def.email, existing.id as string);
      console.log(`  já existe: ${def.fullName}`);
      continue;
    }

    const { data: created, error } = await supabase.auth.admin.createUser({
      email: def.email,
      password: TEMP_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: def.fullName },
    });

    if (error || !created.user) {
      errors.push({ row: -1, reason: `Falha ao criar usuário ${def.email}: ${error?.message}`, data: {} });
      continue;
    }

    await supabase
      .from("profiles")
      .update({ role: def.role, team_id: teamId, must_change_password: true })
      .eq("id", created.user.id);

    emailToProfileId.set(def.email, created.user.id);
    console.log(`  criado: ${def.fullName} <${def.email}>`);
  }

  await supabase.from("teams").update({ manager_id: emailToProfileId.get(TEAM_MANAGER_EMAIL) }).eq("id", teamId);

  function resolveOwnerId(pipedriveName: string): string | null {
    const def = OWNER_MAP[pipedriveName.trim()];
    if (!def) return null;
    return emailToProfileId.get(def.email) ?? null;
  }

  // 4) Pipelines e estágios ---------------------------------------------------
  console.log("\nRecriando pipelines e estágios...");

  // Remove o pipeline placeholder do seed inicial (0 negócios usam ele).
  const { data: placeholderPipeline } = await supabase
    .from("pipelines")
    .select("id")
    .eq("name", "Pipeline padrão")
    .maybeSingle();
  if (placeholderPipeline) {
    await supabase.from("pipeline_stages").delete().eq("pipeline_id", placeholderPipeline.id);
    await supabase.from("pipelines").delete().eq("id", placeholderPipeline.id);
    console.log("  pipeline placeholder removido.");
  }

  const pipelineIdByName = new Map<string, string>();
  const stageIdByPipelineAndName = new Map<string, string>();

  for (const def of PIPELINE_DEFS) {
    let { data: pipeline } = await supabase
      .from("pipelines")
      .select("id")
      .eq("name", def.name)
      .maybeSingle();

    if (!pipeline) {
      const { data: created, error } = await supabase
        .from("pipelines")
        .insert({ name: def.name, is_default: def.isDefault })
        .select("id")
        .single();
      if (error) throw error;
      pipeline = created;
      console.log(`  criado funil: ${def.name}`);
    }

    pipelineIdByName.set(def.name, pipeline!.id as string);

    for (let i = 0; i < def.stages.length; i++) {
      const stageName = def.stages[i];
      const key = `${pipeline!.id}:${stageName}`;
      let { data: stage } = await supabase
        .from("pipeline_stages")
        .select("id")
        .eq("pipeline_id", pipeline!.id)
        .eq("name", stageName)
        .maybeSingle();

      if (!stage) {
        const { data: created, error } = await supabase
          .from("pipeline_stages")
          .insert({ pipeline_id: pipeline!.id, name: stageName, order_index: i })
          .select("id")
          .single();
        if (error) throw error;
        stage = created;
      }
      stageIdByPipelineAndName.set(key, stage!.id as string);
    }
  }

  // 5) Organizações (deduplicadas por Organização - ID) -----------------------
  console.log("\nImportando organizações...");
  const orgIdToUuid = new Map<string, string>();
  const seenOrgIds = new Set<string>();

  for (const row of dataRows) {
    const pipedriveOrgId = cell(row, COL.orgId);
    if (!pipedriveOrgId || seenOrgIds.has(pipedriveOrgId)) continue;
    seenOrgIds.add(pipedriveOrgId);

    const name = cell(row, COL.orgName);
    if (!name) continue;

    const ownerName = cell(row, COL.orgOwner);
    const ownerId = resolveOwnerId(ownerName) ?? adminId;

    const website = cell(row, COL.orgWebsite1) || cell(row, COL.orgWebsite2) || null;

    const { data: existing } = await supabase
      .from("organizations")
      .select("id")
      .eq("name", name)
      .maybeSingle();

    if (existing) {
      orgIdToUuid.set(pipedriveOrgId, existing.id as string);
      continue;
    }

    const { data: created, error } = await supabase
      .from("organizations")
      .insert({
        name,
        owner_id: ownerId,
        address: cell(row, COL.orgAddress) || null,
        city: cell(row, COL.orgCity) || null,
        state: cell(row, COL.orgState) || null,
        website,
        linkedin_url: cell(row, COL.orgLinkedin) || null,
        company_size: cell(row, COL.orgEmployeeCount) || null,
        sector: null,
        notes: cell(row, COL.orgCurrentProvider) || null,
      })
      .select("id")
      .single();

    if (error || !created) {
      errors.push({ row: -1, reason: `Falha ao criar organização ${name}: ${error?.message}`, data: { pipedriveOrgId } });
      continue;
    }
    orgIdToUuid.set(pipedriveOrgId, created.id as string);
  }
  console.log(`  ${orgIdToUuid.size} organizações únicas.`);

  // 6) Contatos (deduplicados por Pessoa - ID) --------------------------------
  console.log("\nImportando contatos...");
  const personIdToUuid = new Map<string, string>();
  const seenPersonIds = new Set<string>();

  for (const row of dataRows) {
    const pipedrivePersonId = cell(row, COL.personId);
    if (!pipedrivePersonId || seenPersonIds.has(pipedrivePersonId)) continue;
    seenPersonIds.add(pipedrivePersonId);

    const name = cell(row, COL.personName);
    if (!name) continue;

    const email =
      cell(row, COL.personEmailWork) || cell(row, COL.personEmailHome) || cell(row, COL.personEmailOther) || null;
    const phone =
      cell(row, COL.personPhoneWork) ||
      cell(row, COL.personPhoneHome) ||
      cell(row, COL.personPhoneMobile) ||
      cell(row, COL.personPhoneOther) ||
      null;

    const orgId = orgIdToUuid.get(cell(row, COL.orgId)) ?? null;
    const ownerName = cell(row, COL.owner); // dono do negócio como fallback
    const ownerId = resolveOwnerId(ownerName) ?? adminId;

    if (email) {
      const { data: existing } = await supabase
        .from("contacts")
        .select("id")
        .eq("email", email)
        .maybeSingle();
      if (existing) {
        personIdToUuid.set(pipedrivePersonId, existing.id as string);
        continue;
      }
    }

    const { data: created, error } = await supabase
      .from("contacts")
      .insert({
        name,
        email,
        phone,
        whatsapp: cell(row, COL.personWhatsapp) || null,
        job_title: cell(row, COL.personJobTitle) || null,
        organization_id: orgId,
        owner_id: ownerId,
      })
      .select("id")
      .single();

    if (error || !created) {
      errors.push({ row: -1, reason: `Falha ao criar contato ${name}: ${error?.message}`, data: { pipedrivePersonId } });
      continue;
    }
    personIdToUuid.set(pipedrivePersonId, created.id as string);
  }
  console.log(`  ${personIdToUuid.size} contatos únicos.`);

  // 7) Negócios ---------------------------------------------------------------
  const { count: existingDealsCount } = await supabase
    .from("deals")
    .select("id", { count: "exact", head: true });

  if ((existingDealsCount ?? 0) > 0) {
    console.log(
      `\nA tabela "deals" já tem ${existingDealsCount} registro(s) — abortando a etapa de negócios para não duplicar.`,
    );
    console.log("Se isso for esperado (reexecução parcial), apague os negócios já importados e rode de novo.");
    writeReport(errors, { deals: 0, organizations: orgIdToUuid.size, contacts: personIdToUuid.size, users: emailToProfileId.size });
    return;
  }

  console.log("\nImportando negócios...");
  let imported = 0;

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const rowNumber = i + 2; // +1 pelo header, +1 porque planilhas começam em 1

    const pipelineName = cell(row, COL.pipeline);
    const rawStage = cell(row, COL.stage);
    const title = cell(row, COL.title);

    const pipelineId = pipelineIdByName.get(pipelineName);
    if (!pipelineId) {
      errors.push({ row: rowNumber, reason: `Funil desconhecido: "${pipelineName}"`, data: { title } });
      continue;
    }

    const stageName = normalizeStageName(rawStage);
    const stageId = stageIdByPipelineAndName.get(`${pipelineId}:${stageName}`);
    if (!stageId) {
      errors.push({ row: rowNumber, reason: `Etapa desconhecida: "${rawStage}" (normalizada: "${stageName}") no funil "${pipelineName}"`, data: { title } });
      continue;
    }

    const ownerName = cell(row, COL.owner);
    const ownerId = resolveOwnerId(ownerName);
    if (!ownerId) {
      errors.push({ row: rowNumber, reason: `Proprietário desconhecido: "${ownerName}"`, data: { title } });
      continue;
    }

    const statusRaw = cell(row, COL.status);
    const status = statusRaw === "Ganho" ? "won" : statusRaw === "Perdido" ? "lost" : "open";

    const value = Number(row[COL.value]) || 0;
    const createdAt = parseDate(row, COL.createdAt);
    const closedAt = parseDate(row, COL.closedAt);
    const orgId = orgIdToUuid.get(cell(row, COL.orgId)) ?? null;
    const contactId = personIdToUuid.get(cell(row, COL.personId)) ?? null;

    const { data: deal, error } = await supabase
      .from("deals")
      .insert({
        title: title || "Sem título",
        value,
        currency: "BRL",
        pipeline_id: pipelineId,
        stage_id: stageId,
        organization_id: orgId,
        contact_id: contactId,
        owner_id: ownerId,
        status,
        expected_close_date: parseDate(row, COL.expectedClose)?.slice(0, 10) ?? null,
        source: cell(row, COL.orgOrigin) || null,
        last_activity_at: parseDate(row, COL.personLastActivity),
        created_at: createdAt ?? undefined,
        updated_at: closedAt ?? createdAt ?? undefined,
      })
      .select("id")
      .single();

    if (error || !deal) {
      errors.push({ row: rowNumber, reason: `Falha ao criar negócio: ${error?.message}`, data: { title } });
      continue;
    }

    await supabase.from("notes").insert({
      deal_id: deal.id,
      author_id: adminId,
      content: `Importado do Pipedrive — funil original: "${pipelineName}", etapa original: "${rawStage}", proprietário original: "${ownerName}".`,
    });

    imported++;
    if (imported % 200 === 0) console.log(`  ${imported} negócios importados...`);
  }

  console.log(`\nConcluído: ${imported} negócios importados, ${errors.length} erro(s).`);
  writeReport(errors, {
    deals: imported,
    organizations: orgIdToUuid.size,
    contacts: personIdToUuid.size,
    users: emailToProfileId.size,
  });
}

function writeReport(
  errors: ImportError[],
  totals: { deals: number; organizations: number; contacts: number; users: number },
) {
  const report = { totals, errorCount: errors.length, errors };
  writeFileSync("import-report.json", JSON.stringify(report, null, 2), "utf-8");
  console.log("Relatório salvo em import-report.json");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
