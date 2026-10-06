// Delivery by the provider and approval by the client: explicit, adjustment request or tacit (deadline).
import { addDays, addLedger, audit, contractById, draft, notifyClient, notifyProvider, today, update } from "../store.js";
import { money } from "../ui.js";
import { issueInvoice } from "./business.js";
import { actions as A, go, ok, warn } from "./core.js";

const APPROVAL_DAYS = 7;
const DEFAULT_CAPTION = { photo: "Foto do serviço concluído", video: "Vídeo do funcionamento", document: "Nota fiscal dos materiais", location: "Local da obra registrado" };
export const CASCADE_MODE = "Liberação em cascata (etapa da obra principal aprovada)";

A.startDelivery = ({ id, stage }) => {
  update((s) => { s.ui.drafts.entrega = { key: `${id}:${stage}`, attachments: [], caption: "" }; });
  go(`#/entrega/${id}/${stage}`);
};
A.addAttachment = ({ kind }) => update((s) => {
  const d = s.ui.drafts.entrega;
  const site = contractById(s, d.key.split(":")[0])?.address;
  const fallback = kind === "location" && site ? `Local: ${site}` : DEFAULT_CAPTION[kind];
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
      delivery: { description, attachments, sentAt: today(), deadline: addDays(APPROVAL_DAYS) },
    });
    notifyClient(s, c, `Entrega da etapa ${idx + 1} recebida`, `Aprove até ${addDays(APPROVAL_DAYS)} · ${c.title}`, "upload-simple", `#/servico/${id}`);
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
