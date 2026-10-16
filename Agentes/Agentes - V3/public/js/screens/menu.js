// Full-screen menu in the BTG Banking style: grey background with square tiles, opened by the Menu button on the home.
import { canSee, person } from "../store.js";
import { receives } from "./home.js";
import { actionAttrs, appbar, btn, byEnv, esc, icon, screen } from "../ui.js";

const APP_VERSION = byEnv("Aval 1.1.0", "Aval 1.1.0 · simulação");

/** Tiles: [label, icon, target]; the target is a route, or { action } to run one. Tools for whoever receives open on that side. */
const PAYMENTS = [
  ["Cobrar", "hand-coins", { action: "startCharge" }], ["Pagar", "wallet", { action: "startPayment" }],
  ["Pagamentos", "seal-check", "#/servicos"], ["Assistente", "sparkle", "#/assistente"], ["Disputas", "scales", "#/disputas"],
  ["Benefícios", "star", "#/beneficios"], ["Movimentos", "receipt", "#/extrato"],
];
const RECEIVING = [["Antecipar", "lightning", "#/agenda"], ["Agenda", "calendar-blank", "#/agenda"], ["Notas fiscais", "receipt", "#/notas"], ["Seu selo", "seal-check", "#/selo"]];

const tile = ([label, ic, target], mode) => {
  const attrs = typeof target === "object" ? actionAttrs(target) : mode ? actionAttrs({ action: "goAs", data: { mode, to: target } }) : actionAttrs({ go: target });
  return `<button type="button" class="bk-tile" ${attrs}>${icon(ic)}<span>${esc(label)}</span></button>`;
};
const group = (title, tiles, mode) => `<section class="bk-group"><h3>${esc(title)}</h3><div class="bk-grid">${tiles.map((t) => tile(t, mode)).join("")}</div></section>`;

function menu(s) {
  const bank = [["Conta e saldo", "bank", "#/no-app-btg/conta"], ["Open Finance", "arrows-left-right", "#/no-app-btg/open-finance"], ["Cartões", "credit-card", "#/no-app-btg/cartoes"], ["Abrir o app do BTG", "arrow-right", "#/btg"]];
  const help = [["Avisos", "bell", "#/avisos"], ["Arbitragem", "gavel", "#/arbitragem"], ["Perfil", "user", "#/perfil"], ["Ajuda", "info", "#/ajuda"]];
  return screen({
    cls: "bk-menu-screen",
    header: `<header class="bk-menu-head"><h2>Menu</h2><button type="button" class="icon-btn" data-go="#/inicio" aria-label="Fechar menu">${icon("x")}</button></header>`,
    body: `${group("Pagamentos", PAYMENTS)}
      ${receives(s, s.contracts.filter((c) => canSee(c, s))) ? group("Para quem recebe", RECEIVING, "prestador") : ""}
      ${group("No app do BTG", bank)}
      ${group("Ajuda e configurações", help)}
      <div class="bk-menu-foot"><button type="button" class="bk-primary" data-action="logout">Sair da conta${icon("sign-out")}</button><small>${esc(person(s)?.name ?? "")} · ${APP_VERSION}</small></div>`,
  });
}

/** What lives in the bank app: the Aval only says it exists and opens the BTG app (simulated here). */
const HANDOFF = {
  conta: ["Conta e saldo", "Sua conta, o saldo e o extrato completo ficam no app do BTG. No Aval você vê só o que é dos pagamentos."],
  "open-finance": ["Open Finance", "Trazer dados de outros bancos ajuda a liberar mais empréstimo na hora. Isso é feito no app do BTG."],
  cartoes: ["Cartões", "Limite, fatura e configurações do cartão ficam no app do BTG. No Aval você usa o cartão para pagar."],
  pontos: ["Pontos BTG", "Os pontos que você ganha pagando com o Aval entram no programa de pontos do BTG, onde você troca por milhas e descontos."],
  cofrinho: ["Cofrinho", "O cofrinho é do app do BTG. No Aval você só guarda dinheiro para um pagamento e vê quanto rende."],
  nota: ["Sua nota de crédito", "A nota completa, com histórico, fica no app do BTG. No Aval você vê o que ela muda em cada pagamento."],
};
function handoff(s, { what }) {
  const [title, text] = HANDOFF[what] ?? ["App do BTG", "Isso fica no app do BTG."];
  return screen({
    header: appbar({ title }),
    body: `<div class="center-block">${icon("bank")}<h2>Isso fica no app do BTG</h2><p class="muted">${esc(text)}</p></div>`,
    footer: `${btn("Abrir o app do BTG", { go: "#/btg", iconName: "arrow-right" })}${btn("Voltar ao Aval", { kind: "text", action: "back" })}`,
  });
}

export const menuRoutes = { menu };
export const handoffRoutes = { "no-app-btg/:what": handoff };
