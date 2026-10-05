// Delivery by the provider and approval by the client: explicit, by reply (read by Jev) or tacit.
import { judge } from "../api.js";
import { addDays, addLedger, audit, contractById, draft, getState, notifyClient, notifyProvider, setDraft, today, update } from "../store.js";
import { money } from "../ui.js";
import { issueInvoice } from "./business.js";
import { actions as A, go, ok, warn } from "./core.js";

const APPROVAL_DAYS = 7;
const DEFAULT_CAPTION = { photo: "Foto do serviço concluído", video: "Vídeo do funcionamento", document: "Nota fiscal dos materiais", location: "Local da obra registrado" };
export const CASCADE_MODE = "Liberação em cascata (etapa da obra principal aprovada)";

A.startDelivery = ({ id, stage }) => {
  update((s) => { s.ui.drafts.entrega = { key: `${id}:${stage}`, attachments: [], caption: "", coverage: null }; });
  go(`#/entrega/${id}/${stage}`);
};
A.addAttachment = ({ kind }) => update((s) => {
  const d = s.ui.drafts.entrega;
  const site = contractById(s, d.key.split(":")[0])?.address;
  const fallback = kind === "location" && site ? `Local: ${site}` : DEFAULT_CAPTION[kind];
  const caption = (d.caption ?? "").trim() || fallback;
  d.attachments = [...d.attachments, { kind, caption }];
  d.caption = "";
  d.coverage = null;
});
A.removeAttachment = ({ index }) => update((s) => {
  const d = s.ui.drafts.entrega;
  d.attachments = d.attachments.filter((_, i) => i !== Number(index));
  d.coverage = null;
});
function deliveryInput(c, idx, description, attachments) {
  const st = c.stages[idx];
  return { stageName: st.name, items: st.items, description, attachments };
}
A.checkDelivery = async ({ id, stage }) => {
  const c = contractById(getState(), id);
  const description = draft("entrega.description").trim();
  const attachments = draft("entrega.attachments", []);
  if (!description) return warn("Descreva o que foi feito.");
  const result = await judge("deliveryCoverage", deliveryInput(c, Number(stage), description, attachments), "entrega");
  setDraft("entrega.coverage", result ?? { failed: true }, false);
};
A.sendDelivery = ({ id, stage }) => {
  const idx = Number(stage);
  const description = draft("entrega.description").trim();
  const attachments = draft("entrega.attachments", []);
  if (!description || attachments.length === 0) return warn("Inclua a descrição e pelo menos um anexo.");
  const coverage = draft("entrega.coverage");
  update((s) => {
    const c = contractById(s, id);
    Object.assign(c.stages[idx], {
      status: "awaitingApproval", reply: null,
      delivery: { description, attachments, sentAt: today(), deadline: addDays(APPROVAL_DAYS) },
      coverage: coverage && !coverage.failed ? coverage : null,
    });
    notifyClient(s, c, `Entrega da etapa ${idx + 1} recebida`, `Aprove até ${addDays(APPROVAL_DAYS)} · ${c.title}`, "upload-simple", `#/servico/${id}`);
    s.ui.drafts.entrega = undefined;
  });
  ok("Entrega enviada para aprovação.");
  go(`#/servico/${id}`);
  return A.checkEvidence({ id, stage: idx });
};

A.openApprove = ({ id, stage }) => update((s) => {
  s.ui.sheet = { name: "aprovar", id, stage: Number(stage), mode: "review", route: location.hash };
  s.ui.drafts.reply = "";
});
A.loadCoverage = async ({ id, stage }) => {
  const c = contractById(getState(), id);
  const st = c.stages[stage];
  const result = await judge("deliveryCoverage", deliveryInput(c, stage, st.delivery.description, st.delivery.attachments), `coverage-${id}-${stage}`);
  update((s) => { contractById(s, id).stages[stage].coverage = result ?? { failed: true }; });
};

/** Releases a stage from custody; stages of subcontracts linked to it are released in cascade. */
export function releaseStage(s, c, idx, mode) {
  const st = c.stages[idx];
  Object.assign(st, { status: "released", releasedAt: today(), releaseMode: mode });
  st.invoiceId = issueInvoice(s, c, idx, st.valueCents);
  audit(s, /tácita|cascata/i.test(mode) ? `Regra: ${mode.split(" (")[0].toLowerCase()}` : c.client, "Liberação de etapa", `${c.id} etapa ${idx + 1} · ${mode}`, c.id);
  addLedger(s, c.id, `Liberação etapa ${idx + 1} para ${c.provider}${st.anticipation ? " (quita antecipação)" : ""}`, -st.valueCents);
  notifyProvider(s, c, `Etapa ${idx + 1} liberada`, `${money(st.valueCents)} · ${c.title}`, "check-circle", `#/servico/${c.id}`);
  const next = c.stages[idx + 1];
  if (next?.status === "pending") Object.assign(next, { status: "inProgress", startedAt: today() });
  if (c.stages.every((x) => x.status === "released" || x.status === "split")) {
    c.status = "completed";
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
A.simulateDeadline = ({ id, stage }) => A.approveStage({ id, stage, mode: "Confirmação tácita (prazo sem resposta)" });
function requestAdjustment(s, id, idx, text) {
  const c = contractById(s, id);
  Object.assign(c.stages[idx], { status: "adjustRequested", reply: { text, at: today() } });
  notifyProvider(s, c, `Ajuste pedido na etapa ${idx + 1}`, text.slice(0, 60), "chat-circle-text", `#/servico/${id}`);
  s.ui.sheet = null;
}
A.requestAdjust = ({ id, stage }) => {
  const text = draft("reply", "").trim() || "Preciso de ajustes antes de aprovar.";
  update((s) => requestAdjustment(s, id, Number(stage), text));
  ok("Pedido de ajuste enviado ao prestador.");
};
A.sendReply = async ({ id, stage }) => {
  const idx = Number(stage);
  const text = draft("reply", "").trim();
  if (!text) return warn("Escreva sua resposta ao prestador.");
  const c = contractById(getState(), id);
  const result = await judge("tacitConfirmation", { stageName: c.stages[idx].name, items: c.stages[idx].items, clientMessage: text }, "reply");
  const outcome = result?.value;
  if (result && result.routing === "automatic" && outcome === "reject") {
    update((s) => requestAdjustment(s, id, idx, text));
    return ok("Entendemos que você pediu ajuste. O prestador foi avisado.");
  }
  const mode = result && result.routing === "automatic" && (outcome === "approve" || outcome === "approveWithReservation") ? "confirm" : "ask";
  update((s) => { s.ui.sheet = { ...s.ui.sheet, mode, result }; });
};
