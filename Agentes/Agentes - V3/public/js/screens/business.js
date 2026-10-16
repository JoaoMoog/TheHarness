// Provider business screens: agenda of receivables, invoices and subcontract.
import { ANTICIPATION_SHARES, TEMPLATES, anticipationCheck, anticipationValues } from "../actions/index.js";
import { contractById, providerList, draft, isProviderOf, myContracts, myName, parseDdMm, person } from "../store.js";
import { appbar, btn, card, chip, circle, empty, esc, field, icon, kv, listCard, money, note, option, percent, row, screen } from "../ui.js";
import { switchRow } from "./confirm.js";

const templatePills = (current, action) =>
  `<div class="choice-list wrap">${Object.entries(TEMPLATES).map(([k, [label]]) => `<button type="button" class="pill-option ${current === k ? "on" : ""}" data-action="${action}" data-key="${k}">${esc(label)}</button>`).join("")}</div>`;

const stageChip = (st) => (st.anticipation ? chip("Antecipado", "info") : st.status === "awaitingApproval" ? chip("Entregue", "warn") : st.status === "disputed" ? chip("Em disputa", "neg") : chip("A executar"));

/** Receivables by month: what is in custody, when it is expected, and how much can be anticipated now. */
function agenda(s) {
  const mine = myContracts(s).filter((c) => c.status !== "completed");
  const items = mine.flatMap((c) => c.stages.map((st, i) => ({ c, st, i }))).filter(({ st }) => !["released", "split"].includes(st.status));
  items.sort((a, b) => parseDdMm(a.st.due) - parseDdMm(b.st.due));
  const byMonth = new Map();
  for (const it of items) {
    const label = parseDdMm(it.st.due).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
    byMonth.set(label, [...(byMonth.get(label) ?? []), it]);
  }
  const share = Number(draft("antecipar.share", 0.95));
  const ready = items.find(({ c, i }) => anticipationCheck(s, c, i).every(([, okItem]) => okItem));
  const total = items.reduce((a, { st }) => a + st.valueCents, 0);
  const months = [...byMonth.entries()].map(([month, list]) => listCard(month, list.map(({ c, st, i }) => row({ icon: "calendar-blank", title: `${st.due} · ${c.title}`, detail: `Marco ${i + 1} · ${st.name}`, value: money(st.valueCents), go: `#/servico/${c.id}`, extra: stageChip(st) })).join(""))).join("");
  const toggles = mine.map((c) => `<div class="pad">${switchRow({ ic: "lightning", title: c.title, on: Boolean(c.autoAnticipate), kind: "autoAnticipate", id: c.id, off: "toggleAutoAnticipation" })}</div>`).join("");
  return screen({
    header: appbar({ title: "Agenda de recebíveis" }),
    body: `${card(`<small>A receber nos próximos meses</small><div class="amount">${money(total)}</div><small>${items.length} marco(s) guardado(s) ou a executar</small>`, "navy")}
      ${ready ? card(`<div class="row-between"><strong>Antecipar agora</strong>${chip(`marco ${ready.i + 1} · ${ready.c.title}`, "info")}</div><div class="choice-list wrap">${ANTICIPATION_SHARES.map((v) => `<button type="button" class="pill-option ${share === v ? "on" : ""}" data-action="setAnticipationShare" data-share="${v}">${percent(v)}</button>`).join("")}</div>${kv("Você recebe hoje", money(anticipationValues(ready.st, share).netCents), "pos-text")}${btn("Antecipar", { kind: "secondary small", go: `#/antecipar/${ready.c.id}/${ready.i}`, iconName: "lightning" })}`, "soft") : note("Nenhuma marco entregue para antecipar agora.", "info", "lightning")}
      ${months || empty("Nada a receber.")}
      ${toggles ? listCard("Antecipação automática", toggles) : ""}`,
  });
}

function notas(s) {
  const me = myName(s);
  const list = s.invoices.filter((n) => n.provider === me);
  const total = list.reduce((a, n) => a + n.amountCents, 0);
  return screen({
    header: appbar({ title: "Notas fiscais" }),
    body: `${card(`<small class="muted">Emitidas automaticamente a cada liberação</small><div class="amount dark">${money(total)}</div><small class="muted">${list.length} NFS-e · ${esc(person(s).providerDoc)}</small>`)}
      ${list.length ? listCard("", list.map((n) => row({ icon: "receipt", title: `${n.id} · ${n.client}`, detail: `${n.issuedAt} · ${contractById(s, n.contractId)?.title ?? n.contractId} · marco ${n.stage + 1}`, value: money(n.amountCents), tone: "pos" })).join("")) : empty("Nenhuma nota emitida ainda.")}
      ${note("A NFS-e sai em nome do seu MEI ou CNPJ quando o dinheiro deixa o valor guardado. Você não precisa emitir nada.", "info", "file-text")}`,
  });
}

function subcontratar(s, { id, stage }) {
  const c = contractById(s, id);
  const idx = Number(stage);
  const st = c && isProviderOf(c, s) ? c.stages[idx] : null;
  if (!st) return screen({ header: appbar({ title: "Subcontratar" }), body: empty("Marco não encontrado.") });
  const chosen = draft("sub.provider");
  const options = providerList(s).filter((p) => ![c.provider, c.client, person(s).providerName].includes(p.name));
  return screen({
    header: appbar({ title: "Subcontratar marco" }),
    body: `${card(`<small class="muted">${esc(c.title)} · marco ${idx + 1}</small><h3>${esc(st.name)}</h3>${kv("Valor do marco", money(st.valueCents))}${kv("Prazo", st.due)}`)}
      <h3>Quem vai executar</h3>${options.map((p) => option({ title: p.name, sub: `${p.activity} · nota ${p.rating}`, selected: chosen === p.name, action: "chooseSubProvider", data: { name: p.name } })).join("")}
      ${card(`${field("Valor do subcontrato (R$)", { bind: "sub.value", value: draft("sub.value"), inputmode: "decimal" })}${field("O que ele entrega", { bind: "sub.description", value: draft("sub.description"), multiline: true, rows: 2 })}`)}
      ${note("O valor sai do seu saldo BTG para o valor guardado. Quando o marco da obra principal for aprovado, o subcontratado recebe na mesma hora.", "info", "tree-structure")}`,
    footer: btn("Criar subcontrato", { action: "createSubcontract", data: { id, stage }, iconName: "tree-structure" }),
  });
}

export const businessRoutes = {
  agenda, notas, "subcontratar/:id/:stage": subcontratar,
};
