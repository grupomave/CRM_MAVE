import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllRows } from "@/lib/supabase/fetch-all";
import { dayKeyInSaoPaulo, saoPauloDayBounds } from "@/lib/date-range";
import { formatOverdue } from "@/lib/deal-alerts";
import { isMailConfigured, sendMail } from "@/lib/mail";

// Resumo diário (08:00, horário de Brasília) das atividades pendentes:
//  - cada usuário recebe as próprias atividades (do dia e/ou atrasadas);
//  - o gestor da equipe recebe também o resumo dos membros da equipe, agrupado
//    por vendedor (gestor = gestor definido na equipe + usuários com papel
//    "gestor" naquela equipe).
// O que entra (dia / atrasadas) e quem recebe (vendedor / gestor) é definido em
// Configurações > Resumo diário (tabela digest_settings).

type Admin = ReturnType<typeof createAdminClient>;

export interface DigestActivity {
  id: string;
  subject: string;
  due_date: string;
  type: string;
  deal_id: string | null;
  deal_title: string | null;
  owner_id: string;
  overdue: boolean;
}

interface Person {
  id: string;
  name: string;
  email: string;
  team_id: string | null;
  role: string;
}

export interface DigestResult {
  date: string;
  enabled: boolean;
  mailConfigured: boolean;
  dryRun: boolean;
  planned: { to: string; kind: "seller" | "manager"; today: number; overdue: number }[];
  sent: number;
  skipped: number;
  errors: string[];
}

const TYPE_LABEL: Record<string, string> = {
  task: "Tarefa",
  call: "Ligação",
  meeting: "Reunião",
  email: "E-mail",
  whatsapp: "WhatsApp",
};

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const timeFmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const dateTimeFmt = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function appUrl() {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercel ? `https://${vercel}` : "";
}

function activityLine(a: DigestActivity, now: Date) {
  const base = appUrl();
  const when = a.overdue
    ? `${dateTimeFmt.format(new Date(a.due_date))} — atrasada ${formatOverdue(a.due_date, now)?.label ?? ""}`
    : `hoje às ${timeFmt.format(new Date(a.due_date))}`;
  const deal = a.deal_title ? (a.deal_id && base ? `${a.deal_title} (${base}/deals/${a.deal_id})` : a.deal_title) : "";
  return {
    html: `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e9ed"><strong>${esc(a.subject)}</strong>
        <div style="color:#5b6b78;font-size:12px">${esc(TYPE_LABEL[a.type] ?? a.type)}${
          a.deal_title
            ? ` · ${a.deal_id && base ? `<a href="${base}/deals/${a.deal_id}" style="color:#255474">${esc(a.deal_title)}</a>` : esc(a.deal_title)}`
            : ""
        }</div></td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e9ed;white-space:nowrap;color:${a.overdue ? "#b42318" : "#14202a"}">${esc(when)}</td>
    </tr>`,
    text: `• ${a.subject} [${TYPE_LABEL[a.type] ?? a.type}] — ${when}${deal ? ` — ${deal}` : ""}`,
  };
}

function section(title: string, items: DigestActivity[], now: Date, tone: "danger" | "default") {
  if (items.length === 0) return { html: "", text: "" };
  const lines = items.map((a) => activityLine(a, now));
  return {
    html: `<h3 style="margin:18px 0 6px;font-size:15px;color:${tone === "danger" ? "#b42318" : "#255474"}">${esc(title)} (${items.length})</h3>
      <table style="width:100%;border-collapse:collapse;font-size:14px">${lines.map((l) => l.html).join("")}</table>`,
    text: `${title} (${items.length})\n${lines.map((l) => l.text).join("\n")}\n`,
  };
}

function layout(heading: string, intro: string, bodyHtml: string) {
  const base = appUrl();
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#f6f7f8;font-family:Inter,Segoe UI,Arial,sans-serif;color:#14202a">
  <div style="max-width:640px;margin:0 auto;padding:24px 16px">
    <div style="background:#fff;border:1px solid #dde3e8;border-radius:10px;padding:22px 22px 18px">
      <div style="font-size:12px;color:#5b6b78;text-transform:uppercase;letter-spacing:.06em">Grupo Mave CRM</div>
      <h2 style="margin:4px 0 4px;font-size:20px">${esc(heading)}</h2>
      <p style="margin:0 0 6px;color:#5b6b78;font-size:14px">${esc(intro)}</p>
      ${bodyHtml}
      ${base ? `<p style="margin:22px 0 0"><a href="${base}/activities" style="display:inline-block;background:#255474;color:#fff;text-decoration:none;padding:9px 16px;border-radius:6px;font-size:14px">Abrir minhas atividades</a></p>` : ""}
    </div>
    <p style="text-align:center;color:#98a8b5;font-size:12px;margin:12px 0 0">Resumo automático enviado todos os dias às 08:00. Para ajustar, fale com o administrador do CRM.</p>
  </div></body></html>`;
}

const counts = (items: DigestActivity[]) => ({
  today: items.filter((a) => !a.overdue).length,
  overdue: items.filter((a) => a.overdue).length,
});

function subjectFor(prefix: string, dateLabel: string, c: { today: number; overdue: number }) {
  const parts = [];
  if (c.today) parts.push(`${c.today} ${c.today === 1 ? "do dia" : "do dia"}`);
  if (c.overdue) parts.push(`${c.overdue} ${c.overdue === 1 ? "atrasada" : "atrasadas"}`);
  return `${prefix} — ${dateLabel} (${parts.join(", ")})`;
}

export async function runDailyDigest({
  dryRun = false,
  force = false,
  now = new Date(),
}: { dryRun?: boolean; force?: boolean; now?: Date } = {}): Promise<DigestResult> {
  const admin: Admin = createAdminClient();
  const [y, m, d] = dayKeyInSaoPaulo(now).split("-");
  const dateLabel = `${d}/${m}/${y}`;
  const result: DigestResult = {
    date: `${y}-${m}-${d}`,
    enabled: true,
    mailConfigured: isMailConfigured(),
    dryRun,
    planned: [],
    sent: 0,
    skipped: 0,
    errors: [],
  };

  const { data: settings } = await admin.from("digest_settings").select("*").eq("id", 1).maybeSingle();
  if (!settings || !settings.enabled) {
    result.enabled = false;
    return result;
  }
  if (!settings.include_today && !settings.include_overdue) return result;

  const { start: todayStart, end: todayEnd } = saoPauloDayBounds(now);

  // Atividades pendentes: do dia e/ou atrasadas
  type RawActivity = {
    id: string;
    subject: string;
    due_date: string;
    type: string;
    deal_id: string | null;
    owner_id: string;
  };
  const raw = await fetchAllRows<RawActivity>((from, to) => {
    let q = admin
      .from("activities")
      .select("id, subject, due_date, type, deal_id, owner_id")
      .eq("done", false)
      .not("due_date", "is", null)
      .order("due_date")
      .range(from, to);
    if (settings.include_overdue && settings.include_today) q = q.lte("due_date", todayEnd);
    else if (settings.include_today) q = q.gte("due_date", todayStart).lte("due_date", todayEnd);
    else q = q.lt("due_date", todayStart);
    return q as unknown as PromiseLike<{ data: RawActivity[] | null; error: unknown }>;
  });

  if (raw.length === 0) return result;

  // Títulos dos negócios (em lotes, para não estourar a URL)
  const dealIds = Array.from(new Set(raw.map((a) => a.deal_id).filter(Boolean) as string[]));
  const dealTitle = new Map<string, string>();
  for (let i = 0; i < dealIds.length; i += 150) {
    const { data } = await admin.from("deals").select("id, title").in("id", dealIds.slice(i, i + 150));
    for (const row of data ?? []) dealTitle.set(row.id, row.title);
  }

  const activities: DigestActivity[] = raw.map((a) => ({
    ...a,
    deal_title: a.deal_id ? (dealTitle.get(a.deal_id) ?? null) : null,
    overdue: a.due_date < todayStart,
  }));

  // Pessoas (com e-mail) e equipes
  const [{ data: profiles }, { data: authList }, { data: teams }] = await Promise.all([
    admin.from("profiles").select("id, full_name, role, team_id, is_active"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("teams").select("id, name, manager_id"),
  ]);
  const emailById = new Map((authList?.users ?? []).map((u) => [u.id, u.email ?? null]));
  const people = new Map<string, Person>();
  for (const p of profiles ?? []) {
    const email = emailById.get(p.id);
    if (!p.is_active || !email) continue;
    people.set(p.id, { id: p.id, name: p.full_name, email, team_id: p.team_id, role: p.role });
  }

  // Já enviados hoje (idempotência: reexecutar o cron não duplica e-mails)
  const alreadySent = new Set<string>();
  if (!force) {
    const { data: log } = await admin
      .from("digest_log" as never)
      .select("recipient_id, kind")
      .eq("sent_on", result.date)
      .eq("status", "sent");
    for (const row of (log ?? []) as unknown as { recipient_id: string; kind: string }[]) {
      alreadySent.add(`${row.recipient_id}:${row.kind}`);
    }
  }

  type Outgoing = { person: Person; kind: "seller" | "manager"; items: DigestActivity[]; html: string; text: string; subject: string };
  const outgoing: Outgoing[] = [];
  const byOwner = new Map<string, DigestActivity[]>();
  for (const a of activities) {
    const list = byOwner.get(a.owner_id);
    if (list) list.push(a);
    else byOwner.set(a.owner_id, [a]);
  }

  // 1) Responsáveis recebem as próprias atividades
  if (settings.notify_sellers) {
    for (const [ownerId, items] of byOwner) {
      const person = people.get(ownerId);
      if (!person) continue;
      const c = counts(items);
      const overdue = section("Atrasadas", items.filter((a) => a.overdue), now, "danger");
      const today = section("Para hoje", items.filter((a) => !a.overdue), now, "default");
      outgoing.push({
        person,
        kind: "seller",
        items,
        subject: subjectFor("Suas atividades", dateLabel, c),
        html: layout(`Bom dia, ${person.name.split(" ")[0]}!`, `Suas atividades pendentes em ${dateLabel}.`, overdue.html + today.html),
        text: `Bom dia, ${person.name.split(" ")[0]}!\nSuas atividades pendentes em ${dateLabel}.\n\n${overdue.text}\n${today.text}`,
      });
    }
  }

  // 2) Gestores recebem o resumo da equipe (membros ativos, exceto o próprio gestor)
  if (settings.notify_managers) {
    const managersByTeam = new Map<string, Set<string>>();
    for (const t of teams ?? []) {
      const set = new Set<string>();
      if (t.manager_id) set.add(t.manager_id);
      managersByTeam.set(t.id, set);
    }
    for (const p of people.values()) {
      if (p.role === "gestor" && p.team_id) {
        const set = managersByTeam.get(p.team_id) ?? new Set<string>();
        set.add(p.id);
        managersByTeam.set(p.team_id, set);
      }
    }
    const teamName = new Map((teams ?? []).map((t) => [t.id, t.name]));

    // Um gestor pode cuidar de mais de uma equipe: junta tudo em um único e-mail
    const perManager = new Map<string, Set<string>>();
    for (const [teamId, managers] of managersByTeam) {
      for (const managerId of managers) {
        const set = perManager.get(managerId) ?? new Set<string>();
        set.add(teamId);
        perManager.set(managerId, set);
      }
    }

    for (const [managerId, teamIds] of perManager) {
      const manager = people.get(managerId);
      if (!manager) continue;
      const members = Array.from(people.values()).filter(
        (p) => p.id !== managerId && p.team_id && teamIds.has(p.team_id) && byOwner.has(p.id),
      );
      if (members.length === 0) continue;
      members.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      const all = members.flatMap((p) => byOwner.get(p.id) ?? []);
      let html = "";
      let text = "";
      for (const member of members) {
        const items = byOwner.get(member.id) ?? [];
        const c = counts(items);
        const label = `${member.name}${member.team_id ? ` · ${teamName.get(member.team_id) ?? ""}` : ""}`;
        const overdue = section("Atrasadas", items.filter((a) => a.overdue), now, "danger");
        const today = section("Para hoje", items.filter((a) => !a.overdue), now, "default");
        html += `<h2 style="margin:22px 0 0;font-size:16px;border-top:2px solid #255474;padding-top:12px">${esc(label)} <span style="font-weight:400;color:#5b6b78;font-size:13px">— ${c.today} do dia, ${c.overdue} atrasadas</span></h2>${overdue.html}${today.html}`;
        text += `=== ${label} (${c.today} do dia, ${c.overdue} atrasadas) ===\n${overdue.text}\n${today.text}\n`;
      }
      outgoing.push({
        person: manager,
        kind: "manager",
        items: all,
        subject: subjectFor("Atividades da equipe", dateLabel, counts(all)),
        html: layout(`Resumo da equipe — ${dateLabel}`, `Atividades pendentes de ${members.length} ${members.length === 1 ? "pessoa" : "pessoas"} da sua equipe.`, html),
        text: `Resumo da equipe — ${dateLabel}\n\n${text}`,
      });
    }
  }

  for (const mail of outgoing) {
    const c = counts(mail.items);
    result.planned.push({ to: mail.person.email, kind: mail.kind, ...c });
    if (dryRun) continue;
    if (alreadySent.has(`${mail.person.id}:${mail.kind}`)) {
      result.skipped++;
      continue;
    }
    const sent = await sendMail({ to: mail.person.email, subject: mail.subject, html: mail.html, text: mail.text });
    await admin.from("digest_log" as never).insert({
      sent_on: result.date,
      recipient_id: mail.person.id,
      recipient_email: mail.person.email,
      kind: mail.kind,
      activities_count: mail.items.length,
      status: sent.ok ? "sent" : "error",
      error: sent.ok ? null : sent.error,
    } as never);
    if (sent.ok) result.sent++;
    else result.errors.push(`${mail.person.email}: ${sent.error}`);
  }

  return result;
}
