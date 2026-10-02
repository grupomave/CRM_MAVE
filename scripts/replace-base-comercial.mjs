// Substitui negócios, pessoas e organizações do CRM pela base comercial atualizada
// (planilha Pipedrive de 30/09/2026, já tratada em docs/replace-payload-2026-09-30.json).
//
// Uso (na pasta do projeto):
//   node scripts/replace-base-comercial.mjs            -> SIMULAÇÃO: não grava nada, só mostra os números
//   node scripts/replace-base-comercial.mjs --apply    -> APLICA a troca (pede confirmação)
//
// A troca roda numa única transação no banco (função replace_comercial_base):
// se qualquer passo falhar, nada é apagado. Backup das tabelas originais no
// schema backup_20260930 do próprio banco.
import { readFileSync, existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";

function loadEnvLocal() {
  if (!existsSync(".env.local")) throw new Error(".env.local não encontrado (rode na raiz do projeto).");
  for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    const value = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY precisam estar em .env.local");

const apply = process.argv.includes("--apply");
const payload = JSON.parse(readFileSync("docs/replace-payload-2026-09-30.json", "utf-8"));
console.log(
  `Arquivo lido: ${payload.deals.length} negócios, ${payload.orgs.length} organizações, ${payload.contacts.length} pessoas.`,
);
console.log(`Projeto: ${url}`);

if (apply) {
  console.log("\nATENÇÃO: isto APAGA todos os negócios, pessoas e organizações atuais e importa os da planilha.");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('Digite "sim" para continuar: ');
  rl.close();
  if (answer.trim().toLowerCase() !== "sim") {
    console.log("Cancelado. Nada foi alterado.");
    process.exit(0);
  }
}

const res = await fetch(`${url}/rest/v1/rpc/replace_comercial_base`, {
  method: "POST",
  headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
  body: JSON.stringify({ payload, dry_run: !apply }),
});
const text = await res.text();
if (!res.ok) {
  console.error(`Erro ${res.status}: ${text}`);
  process.exit(1);
}
const out = JSON.parse(text);
console.log(apply ? "\nTroca CONCLUÍDA:" : "\nSIMULAÇÃO (nada foi gravado):");
console.log(JSON.stringify(out, null, 2));
if (!apply) console.log("\nSe os números estiverem corretos, rode de novo com --apply.");
