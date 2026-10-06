// Trust layer: contract chat (mediation on request), new date proposals, evidence anti-fraud rules and block appeals.
import { addDays, audit, contractById, draft, getState, isProviderOf, notify, notifyBank, notifyClient, notifyProvider, setDraft, today, update } from "../store.js";
import { maybeAutoAnticipate } from "./business.js";
import { actions as A, go, ok, warn } from "./core.js";

const BIG_STAGE_CENTS = 300_000;
export const RESCHEDULE_OPTIONS = [7, 14, 21];

// Contract chat: auditable and used as evidence; either side can call a mediator before a dispute
A.sendMessage = ({ id }) => {
  const text = draft(`msg.${id}`, "").trim();
  if (!text) return;
  const s0 = getState();
  const from = isProviderOf(contractById(s0, id), s0) ? "provider" : "client";
  update((s) => {
    s.messages[id] = [...(s.messages[id] ?? []), { from, text, at: today() }];
    s.ui.drafts.msg = { ...s.ui.drafts.msg, [id]: "" };
    const ct = contractById(s, id);
    if (from === "client") notifyProvider(s, ct, "Nova mensagem", text.slice(0, 60), "chat-circle-text", `#/conversa/${id}`);
    else notifyClient(s, ct, "Nova mensagem", text.slice(0, 60), "chat-circle-text", `#/conversa/${id}`);
  });
};
A.askMediation = ({ id }) => {
  update((s) => {
    const c = contractById(s, id);
    s.chatReadings[id] = { ...s.chatReadings[id], mediationAsked: today() };
    notifyBank(s, "Mediação preventiva pedida", `${c.title} · conversa tensa`, "chat-circle-text", "#/banco/fila");
    notifyProvider(s, c, "Mediação Nexo convidada", "Um mediador entra na conversa antes de virar disputa", "scales", `#/conversa/${id}`);
  });
  ok("Um mediador do Nexo vai entrar na conversa. Nada foi bloqueado.");
};

// Resolution matrix: when the issue is only timing, a new date replaces the dispute
A.chooseNewDate = ({ days }) => setDraft("novaData.days", Number(days), false);
A.proposeNewDate = ({ id, stage }) => {
  const idx = Number(stage);
  const days = Number(draft("novaData.days", RESCHEDULE_OPTIONS[0]));
  update((s) => {
    const c = contractById(s, id);
    c.stages[idx].reschedule = { proposedDue: addDays(days), previousDue: c.stages[idx].due, status: "proposed", at: today() };
    notifyProvider(s, c, "Proposta de nova data", `Etapa ${idx + 1} para ${addDays(days)} · mesmo valor`, "calendar-blank", `#/servico/${id}`);
    s.ui.drafts.disputa = undefined;
  });
  ok("Nova data proposta. O valor da etapa não muda.");
  go(`#/servico/${id}`);
};
A.answerNewDate = ({ id, stage, accept }) => {
  const idx = Number(stage);
  update((s) => {
    const c = contractById(s, id);
    const r = c.stages[idx].reschedule;
    r.status = accept === "yes" ? "accepted" : "refused";
    if (r.status === "accepted") c.stages[idx].due = r.proposedDue;
    notifyClient(s, c, r.status === "accepted" ? "Nova data aceita" : "Nova data recusada", `Etapa ${idx + 1} · ${r.proposedDue}`, "calendar-blank", `#/servico/${id}`);
  });
  ok(accept === "yes" ? "Nova data combinada." : "Proposta recusada. A contratante pode abrir disputa.");
};

/** Anti-fraud checks done in code on the evidence of a delivery. */
export function evidenceFlags(s, c, idx) {
  const st = c.stages[idx];
  const flags = [];
  const others = s.contracts.filter((x) => x.id !== c.id).flatMap((x) => x.stages.flatMap((y) => y.delivery?.attachments ?? []));
  const seen = new Set(others.map((a) => a.caption.trim().toLowerCase()));
  const street = (c.address ?? "").split(",")[0].toLowerCase();
  for (const a of st.delivery.attachments) {
    if (a.kind === "photo" && seen.has(a.caption.trim().toLowerCase())) flags.push(`Foto igual a uma de outro contrato: "${a.caption}"`);
    if (a.kind === "location" && street && !a.caption.toLowerCase().includes(street)) flags.push(`Local diferente do endereço da obra (${c.address})`);
  }
  if (st.startedAt && st.startedAt === st.delivery.sentAt && st.valueCents >= BIG_STAGE_CENTS) flags.push("Etapa grande concluída no mesmo dia em que começou");
  return flags;
}
/** Runs after a delivery is sent: anti-fraud rules in code; auto anticipation only when they are clear. */
A.checkEvidence = ({ id, stage }) => {
  const idx = Number(stage);
  update((s) => {
    const c = contractById(s, id);
    const flags = evidenceFlags(s, c, idx);
    c.stages[idx].fraudCheck = { flags, risky: flags.length > 0, at: today() };
    if (c.stages[idx].fraudCheck.risky) notifyBank(s, "Risco na evidência", `${c.title} · etapa ${idx + 1}`, "warning-circle", `#/banco/fila/EV-${id}-${idx}`);
    else maybeAutoAnticipate(s, c, idx);
  });
};
A.bankEvidenceDecision = ({ id, stage, decision }) => {
  update((s) => {
    const c = contractById(s, id);
    Object.assign(c.stages[Number(stage)].fraudCheck, { decision, decidedAt: today() });
    audit(s, "Luiza Prado · analista", "Antifraude da evidência", `${c.id} etapa ${Number(stage) + 1} · ${decision === "block" ? "bloqueada" : "liberada"}`, c.id);
    if (decision === "block") notify(s, c.provider, "Entrega em análise de segurança", `${c.title} · o Nexo vai falar com você`, "shield-check", `#/servico/${id}`, "prestador");
  });
  ok(decision === "block" ? "Etapa bloqueada para investigação." : "Evidência liberada para a aprovação da contratante.");
};

// Appeal against a block: a person at the bank decides
A.submitAppeal = () => {
  const text = draft("appeal.text").trim();
  const acc = getState().newAccount;
  if (!acc || acc.status !== "refused") return warn("Não há bloqueio para contestar.");
  if (!text) return warn("Explique o que aconteceu.");
  update((s) => {
    s.newAccount.appeal = { text, status: "review", at: today() };
    notifyBank(s, "Contestação de bloqueio", s.newAccount.name, "identification-card", "#/banco/fila/KYC-NEW");
  });
  ok("Contestação enviada. Uma pessoa do Nexo vai revisar em até 2 dias úteis.");
  go("#/conta-analise");
};

A.setNegativationDays = ({ days }) => update((s) => { s.bankSettings.negativationDays = Number(days); });
