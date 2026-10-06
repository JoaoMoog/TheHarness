// Full-screen menu in the Nexo Banking style: grey background with square tiles, opened by the Menu button on the home.
import { isNexoConnected, person } from "../store.js";
import { actionAttrs, esc, icon, screen } from "../ui.js";

const APP_VERSION = "Aval 5.0 · protótipo";

/** Tiles of one side of the account switch to that side first, so the screen opens in the right mode. */
const HIRING = [
  ["Meus serviços", "briefcase", "#/servicos"], ["Novo serviço", "plus", "#/novo/1"], ["Pagar", "qr-code", "#/financeiro"],
  ["Extrato", "receipt", "#/extrato"], ["Disputas", "scales", "#/disputas"], ["Pedir crédito", "hand-coins", "#/credito"],
];
const PROVIDING = [
  ["Orçamento", "file-text", "#/orcamento/novo"], ["Aval Link", "link", "#/link/novo"], ["Maquininha", "device-mobile", "#/pos"],
  ["Agenda", "calendar-blank", "#/agenda"], ["Notas fiscais", "receipt", "#/notas"], ["Serviços prestados", "storefront", "#/servicos"],
];

const tile = ([label, ic, go], mode) => {
  const attrs = mode ? actionAttrs({ action: "goAs", data: { mode, to: go } }) : actionAttrs({ go });
  return `<button type="button" class="bk-tile" ${attrs}>${icon(ic)}<span>${esc(label)}</span></button>`;
};
const group = (title, tiles, mode) => `<section class="bk-group"><h3>${esc(title)}</h3><div class="bk-grid">${tiles.map((t) => tile(t, mode)).join("")}</div></section>`;

function menu(s) {
  const account = [
    isNexoConnected(s) ? ["Conta Nexo", "bank", "#/contas"] : ["Conectar conta Nexo", "bank", "#/conectar"],
    ["Meus créditos", "piggy-bank", "#/creditos"], ["Open Finance", "arrows-left-right", "#/open-finance"],
  ];
  const help = [["Avisos", "bell", "#/avisos"], ["Arbitragem", "gavel", "#/arbitragem"], ["Perfil", "user", "#/perfil"], ["Aval Labs", "lightning", "#/labs"]];
  const hiringFirst = s.session.mode !== "prestador";
  const sides = [group("Contratante", HIRING, "contratante"), group("Prestador", PROVIDING, "prestador")];
  return screen({
    cls: "bk-menu-screen",
    header: `<header class="bk-menu-head"><h2>Menu</h2><button type="button" class="icon-btn" data-go="#/inicio" aria-label="Fechar menu">${icon("x")}</button></header>`,
    body: `${(hiringFirst ? sides : [...sides].reverse()).join("")}
      ${group("Conta Nexo e crédito", account)}
      ${group("Ajuda e configurações", help)}
      <div class="bk-menu-foot"><button type="button" class="bk-primary" data-action="logout">Sair do app${icon("sign-out")}</button><small>${esc(person(s)?.name ?? "")} · ${APP_VERSION}</small></div>`,
  });
}

export const menuRoutes = { menu };
