// Aval IA assistant: understands the request, then opens the right screen. Nothing runs without confirmation.
import { judge, toast } from "../api.js";
import { contractById, draft, getState, isClientOf, update } from "../store.js";
import { actions as A, go, warn } from "./core.js";

const CLIENT_INTENTS = new Set(["approveStage", "pay", "openDispute", "viewStatement", "newService", "requestCredit"]);

export function clientServices(s) {
  return s.contracts.filter((c) => isClientOf(c, s)).map((c) => ({ id: c.id, label: `${c.title} com ${c.provider}` }));
}
A.sendChat = async () => {
  const text = draft("chat.text", "").trim();
  if (!text) return;
  update((s) => { s.chat.push({ from: "user", text }); s.ui.drafts.chat = { text: "" }; });
  const services = clientServices(getState());
  if (services.length === 0) {
    update((s) => { s.chat.push({ from: "ia", result: null, text: "Você ainda não contratou serviços. Comece por um novo serviço." }); });
    return;
  }
  const result = await judge("assistantIntent", { message: text, services }, "chat");
  update((s) => { s.chat.push({ from: "ia", result, text: result ? "" : "Não consegui entender agora. Tente de novo." }); });
};

function openService(s, intent, c) {
  if (intent === "approveStage") {
    const idx = c.stages.findIndex((st) => st.status === "awaitingApproval");
    go(`#/servico/${c.id}`);
    return idx >= 0 ? A.openApprove({ id: c.id, stage: idx }) : toast("Não há etapa esperando aprovação neste serviço.", "info");
  }
  if (intent === "pay") {
    const late = s.installments.find((i) => i.contractId === c.id && i.status === "late");
    if (late) return go("#/financeiro");
    const share = c.participants?.find((p) => p.me);
    if (c.kind === "collective" && share && !share.paid) return go(`#/pagar/${c.id}`);
    return go(c.status === "awaitingPayment" ? `#/pagar/${c.id}` : `#/servico/${c.id}`);
  }
  if (intent === "openDispute") {
    const idx = c.stages.findIndex((st) => ["awaitingApproval", "inProgress", "adjustRequested"].includes(st.status));
    return idx >= 0 ? A.startDispute({ id: c.id, stage: idx }) : warn("Não há etapa em andamento para contestar.");
  }
  return go(`#/servico/${c.id}`);
}

A.chatOpen = ({ intent, service }) => {
  if (CLIENT_INTENTS.has(intent)) update((s) => { s.session.mode = "contratante"; }, { silent: true });
  const s = getState();
  if (intent === "viewStatement") return go("#/extrato");
  if (intent === "newService") return go("#/novo/1");
  if (intent === "requestCredit") return go("#/credito");
  const c = service ? contractById(s, service) : null;
  if (!c) return warn("Escolha um serviço para continuar.");
  return openService(s, intent, c);
};
