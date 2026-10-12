// Delivery by the provider and approval by the client: explicit, adjustment request or tacit (deadline).
import { daysBetween } from "../domain/dates.js";
import { yieldCents } from "../domain/offers.js";
import { addDays, addLedger, audit, contractById, draft, notifyClient, notifyProvider, now, parseDdMm, personOfName, today, update } from "../store.js";
import { AUTO_RELEASE_DAYS } from "../domain/protected.js";
import { money } from "../ui.js";
import { issueInvoice } from "./business.js";
import { actions as A, go, ok, warn } from "./core.js";
import { recordOffer } from "./offers.js";
import { earnPoints } from "./perks.js";
import { anticipationCheck, anticipationValues } from "./provider.js";

const DEFAULT_CAPTION = { photo: "Foto do serviço concluído", video: "Vídeo do funcionamento", document: "Nota fiscal dos materiais", location: "Local da obra registrado" };
export const CASCADE_MODE = "Liberação em cascata (marco da obra principal aprovado)";

A.startDelivery = ({ id, stage }) => {
  update((s) => {
    const name = contractById(s, id)?.stages[Number(stage)]?.name ?? "Marco";
    s.ui.drafts.entrega = { key: `${id}:${stage}`, attachments: [], caption: "", description: `${name}: concluído conforme o combinado, com fotos do antes e depois.` };
  });
  go(`#/entrega/${id}/${stage}`);
};
A.addAttachment = ({ kind }) => update((s) => {
  const d = s.ui.drafts.entrega;
  const site = contractById(s, d.key.split(":")[0])?.address;
  // The default caption names the payment, so two payments never share "the same photo" by accident.
  const fallback = kind === "location" && site ? `Local: ${site}` : `${DEFAULT_CAPTION[kind]} · ${d.key.split(":")[0]}`;
  const caption = (d.caption ?? "").trim() || fallback;
  d.attachments = [...d.attachments, { kind, caption }];
  d.caption = "";
});
A.removeAttachment = ({ index }) => update((s) => {
  const d = s.ui.drafts.entrega;
  d.attachments = d.attachments.filter((_, i) => i !== Number(index));
});
A.sendDelivery = ({ id, stage }) => {
  const idx = Number(stage);
  const description = draft("entrega.description").trim();
  const attachments = draft("entrega.attachments", []);
  if (!description || attachments.length === 0) return warn("Inclua a descrição e pelo menos um anexo.");
  update((s) => {
    const c = contractById(s, id);
    Object.assign(c.stages[idx], {
      status: "awaitingApproval", reply: null,
      delivery: { description, attachments, sentAt: today(), deadline: addDays(AUTO_RELEASE_DAYS) },
    });
    notifyClient(s, c, `Entrega do marco ${idx + 1} recebida`, `Aprove até ${addDays(AUTO_RELEASE_DAYS)} · ${c.title}`, "upload-simple", `#/servico/${id}`);
    if (anticipationCheck(s, c, idx).every(([, okItem]) => okItem)) recordOffer(s, { product: "anticipation", contractId: id, valueCents: anticipationValues(c.stages[idx]).netCents });
    s.ui.drafts.entrega = undefined;
  });
  ok("Entrega enviada para aprovação.");
  go(`#/servico/${id}`);
  A.checkEvidence({ id, stage: idx });
};

A.openApprove = ({ id, stage }) => update((s) => {
  s.ui.sheet = { name: "aprovar", id, stage: Number(stage), route: location.hash };
  s.ui.drafts.reply = "";
});

/** The guarded money yielded while the service ran; it goes back to whoever paid when everything is released. */
function payYield(s, c) {
  const owner = personOfName(c.client, s);
  if (!c.yield || c.yield.paidCents != null || !owner || !s.accounts[owner.id]) return;
  const cents = yieldCents(c.paidInCents, Math.max(0, daysBetween(parseDdMm(c.yield.since), now(s))), c.yield.rate);
  c.yield = { ...c.yield, paidCents: cents, paidAt: today() };
  if (!cents) return;
  s.accounts[owner.id].balanceCents += cents;
  addLedger(s, c.id, `Rendimento do dinheiro guardado · ${c.client}`, cents, "Repasse");
  notifyClient(s, c, "Rendimento creditado", `${money(cents)} do dinheiro guardado · ${c.title}`, "chart-line-up", `#/servico/${c.id}`);
}

/** Releases a stage from custody; stages of subcontracts linked to it are released in cascade. */
export function releaseStage(s, c, idx, mode) {
  const st = c.stages[idx];
  Object.assign(st, { status: "released", releasedAt: today(), releaseMode: mode });
  st.invoiceId = issueInvoice(s, c, idx, st.valueCents);
  audit(s, /tácita|sozinho|cascata/i.test(mode) ? `Regra: ${mode.split(" (")[0].toLowerCase()}` : c.client, "Liberação de marco", `${c.id} marco ${idx + 1} · ${mode}`, c.id);
  addLedger(s, c.id, `Liberação do marco ${idx + 1} para ${c.provider}${st.anticipation ? " (quita antecipação)" : ""}`, -st.valueCents);
  notifyProvider(s, c, `Marco ${idx + 1} liberado`, `${money(st.valueCents)} · ${c.title}`, "check-circle", `#/servico/${c.id}`);
  earnPoints(s, c, st.valueCents);
  const next = c.stages[idx + 1];
  if (next?.status === "pending") Object.assign(next, { status: "inProgress", startedAt: today() });
  if (c.stages.every((x) => x.status === "released" || x.status === "split")) {
    c.status = "completed";
    payYield(s, c);
    notifyClient(s, c, "Serviço concluído", `Avalie ${c.provider}`, "star", `#/avaliar/${c.id}`);
  }
  for (const sub of s.contracts) {
    sub.stages.forEach((subSt, j) => {
      const linked = subSt.linkedTo?.contractId === c.id && subSt.linkedTo.stage === idx;
      if (linked && subSt.status === "awaitingApproval") releaseStage(s, sub, j, CASCADE_MODE);
    });
  }
}
A.approveStage = ({ id, stage, mode = "Aprovação manual" }) => {
  update((s) => {
    releaseStage(s, contractById(s, id), Number(stage), mode);
    s.ui.sheet = null;
  });
  go(`#/comprovante/${id}/${stage}`);
};
A.simulateDeadline = ({ id, stage }) => A.approveStage({ id, stage, mode: "Liberado sozinho (7 dias sem resposta)" });
function requestAdjustment(s, id, idx, text) {
  const c = contractById(s, id);
  Object.assign(c.stages[idx], { status: "adjustRequested", reply: { text, at: today() } });
  notifyProvider(s, c, `Ajuste pedido no marco ${idx + 1}`, text.slice(0, 60), "chat-circle-text", `#/servico/${id}`);
  s.ui.sheet = null;
}
A.requestAdjust = ({ id, stage }) => {
  const text = draft("reply", "").trim() || "Preciso de ajustes antes de aprovar.";
  update((s) => requestAdjustment(s, id, Number(stage), text));
  ok("Pedido de ajuste enviado ao prestador.");
};
