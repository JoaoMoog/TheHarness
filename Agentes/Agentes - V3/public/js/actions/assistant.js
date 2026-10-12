// The assistant in the app (simulated by rules): fills the agreement from a chat, helps the payer define the stages
// in a chat, and answers questions about the protected payment.
import { SUGGESTED_QUESTIONS, answer, frontLoad, improveDescription, parseConversation, suggestStages } from "../domain/assistant.js";
import { SINGLE_STAGE } from "../domain/protected.js";
import { draft, getState, parseReais, update } from "../store.js";
import { money, reais } from "../ui.js";
import { actions as A, go, ok, warn } from "./core.js";

/** A short pause so the reply reads like someone typing. */
const TYPING_MS = 700;
const MAX_STAGES = 5;

/** The AI button on the description: rewrites it clearly and fills value, deadline and address it finds in the text. */
A.improveDescription = () => {
  const typed = String(draft("ag.description", "")).trim();
  if (!typed) return warn("Escreva com suas palavras o que foi combinado. A IA melhora o texto.");
  const better = improveDescription(typed);
  const found = parseConversation(typed);
  update((s) => {
    const ag = s.ui.drafts.ag ?? {};
    s.ui.drafts.ag = {
      ...ag, description: better.text, original: typed, improved: true,
      ...(found.totalCents && !ag.total ? { total: reais(found.totalCents) } : {}),
      ...(found.dueDate && !ag.dueDate && !ag.dueIso ? { dueDate: found.dueDate } : {}),
      ...(found.address && !ag.address && !ag.street ? { address: found.address } : {}),
    };
  });
  ok("Descrição melhorada pela IA. Confira e ajuste se quiser.");
};
A.undoImprove = () => update((s) => {
  const ag = s.ui.drafts.ag ?? {};
  s.ui.drafts.ag = { ...ag, description: ag.original ?? ag.description, improved: false };
});

/** What is being split: a charge received (by its token) or my own payment being written ("novo"). */
function contextOf(s, key) {
  if (key === "novo") return { description: s.ui.drafts.ag?.description ?? "", totalCents: parseReais(s.ui.drafts.ag?.total) ?? 0 };
  const inv = s.invites.find((i) => i.token === key);
  return inv ? { description: inv.description, totalCents: inv.totalCents, proposal: inv.proposal, provider: inv.provider } : null;
}

/** Opens the stages chat with a first suggestion for this service. */
A.openStages = ({ key }) => {
  const s0 = getState();
  const ctx = contextOf(s0, key);
  if (!ctx?.totalCents) return warn("Informe o valor antes de definir os marcos.");
  if (!s0.ui.drafts.stg?.[key]?.messages) {
    const suggested = suggestStages(ctx);
    const fromProvider = ctx.proposal ? { ...suggested, ...ctx.proposal } : null;
    const proposal = fromProvider ?? suggested;
    const text = fromProvider
      ? `${ctx.provider} sugeriu dividir em ${proposal.stages.length} marcos: ${proposal.stages.map((st) => `${st.name}, ${money(st.valueCents)}`).join("; ")}. Você decide: use como está ou peça outra divisão.`
      : `Vou te ajudar a dividir "${proposal.title}" de ${money(ctx.totalCents)}. ${proposal.reason}`;
    update((s) => {
      s.ui.drafts.stg = { ...s.ui.drafts.stg, [key]: { proposal, source: fromProvider ? ctx.provider : null, messages: [{ from: "ai", text }], input: "" } };
    });
  }
  go(`#/etapas/${key}`);
};

/** What the payer asked for: a number of stages, a single value, or a question. */
function interpret(text, ctx, current) {
  const t = text.toLowerCase();
  if (/material|na frente|entrada/.test(t)) {
    const base = current?.release === "stages" ? current : suggestStages({ ...ctx, count: Math.max(2, current?.stages.length ?? 2) });
    const proposal = { ...base, release: "stages", stages: frontLoad(base.stages, ctx.totalCents) };
    return { proposal, text: `Pronto: o primeiro marco ficou com ${money(proposal.stages[0].valueCents)}, para comprar o material no início. O resto sai conforme as entregas.` };
  }
  const count = Number(t.match(/(\d)\s*(?:etapa|marco)/)?.[1]);
  if (count >= 2 && count <= MAX_STAGES) {
    const proposal = suggestStages({ ...ctx, count });
    return { proposal, text: `Pronto, em ${count} marcos. ${proposal.reason}` };
  }
  if (/unic|uma vez|tudo junto/.test(t)) {
    const proposal = { ...suggestStages(ctx), release: "single", stages: [{ name: SINGLE_STAGE, valueCents: ctx.totalCents }] };
    return { proposal, text: "Combinado: valor único, liberado de uma vez quando você aprovar o serviço pronto." };
  }
  return { proposal: null, text: answer(text).text };
}

function reply(key, question) {
  const ctx = contextOf(getState(), key);
  update((s) => {
    const chat = s.ui.drafts.stg[key];
    s.ui.drafts.stg[key] = { ...chat, messages: [...chat.messages, { from: "me", text: question }], typing: true, input: "" };
  });
  setTimeout(() => {
    const { proposal, text } = interpret(question, ctx, getState().ui.drafts.stg[key]?.proposal);
    update((s) => {
      const chat = s.ui.drafts.stg[key];
      s.ui.drafts.stg[key] = { ...chat, messages: [...chat.messages, { from: "ai", text }], typing: false, ...(proposal ? { proposal } : {}) };
    });
  }, TYPING_MS);
}
A.stagesAsk = ({ key }) => {
  const text = String(draft(`stg.${key}.input`, "")).trim();
  if (!text) return warn("Escreva sua pergunta ou o que quer mudar.");
  reply(key, text);
};
A.stagesQuick = ({ key, text }) => reply(key, text);

/** The payer keeps the proposal on screen and goes back to the payment. */
A.stagesUse = ({ key }) => {
  const chat = getState().ui.drafts.stg?.[key];
  if (!chat?.proposal) return;
  const chosen = { release: chat.proposal.release, stages: chat.proposal.stages };
  update((s) => {
    s.ui.drafts.stg[key] = { ...s.ui.drafts.stg[key], chosen };
    if (key === "novo") s.ui.drafts.ag = { ...s.ui.drafts.ag, custom: chosen, ...(s.ui.drafts.ag?.from === "provider" ? {} : { release: chosen.release }) };
  });
  ok(chosen.release === "single" ? "Valor único definido." : `${chosen.stages.length} marcos definidos.`);
  const back = getState().ui.drafts.ag?.from === "provider" ? "#/combinado/3" : "#/combinado/2";
  go(key === "novo" ? back : `#/p/${key}`);
};

/** The assistant chat: free questions or the suggested ones. */
function askAssistant(question) {
  update((s) => {
    const chat = s.ui.drafts.asst ?? { messages: [] };
    s.ui.drafts.asst = { ...chat, messages: [...(chat.messages ?? []), { from: "me", text: question }], typing: true, input: "" };
  });
  setTimeout(() => update((s) => {
    s.ui.drafts.asst = { ...s.ui.drafts.asst, messages: [...s.ui.drafts.asst.messages, { from: "ai", text: answer(question).text }], typing: false };
  }), TYPING_MS);
}
A.askAssistant = () => {
  const text = String(draft("asst.input", "")).trim();
  if (!text) return warn("Escreva sua pergunta.");
  askAssistant(text);
};
A.askSuggested = ({ index }) => askAssistant(SUGGESTED_QUESTIONS[Number(index)]);
