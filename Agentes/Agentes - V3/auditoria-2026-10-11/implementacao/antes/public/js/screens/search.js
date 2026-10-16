// Search over every service and payment of the person: what is on the home, the menu and the statement.
import { searchItems } from "../domain/search.js";
import { draft } from "../store.js";
import { appbar, esc, icon, screen } from "../ui.js";
import { bkSection } from "./btg-kit.js";
import { statementItems } from "./money.js";
import { paymentItems } from "./protected.js";

const SUGGESTIONS = ["Pintura", "Marco", "Pix", "Horizonte"];

function buscar(s) {
  const query = String(draft("busca.q", ""));
  const box = `<div class="search-box">${icon("magnifying-glass")}<input data-bind="busca.q" data-rerender="1" value="${esc(query)}" placeholder="Serviço, pessoa, valor ou marco" aria-label="Buscar serviços e pagamentos"></div>`;
  const found = (items) => searchItems(items.map((x) => ({ title: x.text, html: x.html })), query).map((x) => x.html);
  const services = found(paymentItems(s));
  const movements = found(statementItems(s));
  const hint = `<div class="search-hint"><p>Busque em todos os seus pagamentos: serviços, cobranças, convites e movimentos.</p><div class="asst-chips">${SUGGESTIONS.map((t) => `<button type="button" data-action="searchFor" data-text="${esc(t)}">${esc(t)}</button>`).join("")}</div></div>`;
  const results = services.length || movements.length
    ? `${services.length ? bkSection("Serviços e pagamentos", services) : ""}${movements.length ? bkSection("Movimentos", movements) : ""}`
    : `<p class="empty">Nada encontrado para “${esc(query)}”.</p>`;
  return screen({ cls: "bk-flat", header: `${appbar({ title: "Buscar" })}${box}`, body: query.trim() ? results : hint });
}

export const searchRoutes = { buscar };
