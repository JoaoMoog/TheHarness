// Side column of the solution detail: access, impact, ratings and contacts.
import { icon } from "../ui/icons.js";
import { esc, int, rating, hours } from "../ui/format.js";
import { avgRating } from "../domain/catalog.js";
import { conversion, engagement, hoursSaved } from "../domain/metrics.js";
import { bar, btn, secHead, avatar } from "../ui/components.js";
import { userById } from "../seed/people.js";

function accessBox(s, sol) {
  const mine = s.requests.filter((r) => r.solutionId === sol.id && r.requesterId === s.userId);
  const approved = mine.find((r) => r.status === "aprovada");
  const pending = mine.find((r) => r.status === "pendente");
  const rejected = mine.find((r) => r.status === "rejeitada");
  if (sol.access === "direto") return `<div class="note ok">${icon("unlock")}<div><strong>Acesso direto</strong><div class="small">Não precisa pedir autorização.</div></div></div>`;
  if (approved) return `<div class="note ok">${icon("check")}<div><strong>Seu acesso foi aprovado</strong><div class="small">Por ${esc(userById(approved.decidedBy).name)}.</div></div></div>`;
  if (pending) return `<div class="note info">${icon("clock")}<div><strong>Pedido pendente</strong><div class="small">Aguardando ${esc(userById(sol.ownerId).name)}.</div></div></div>`;
  return `<div class="note warn">${icon("lock")}<div><strong>Exige autorização</strong><div class="small">${rejected ? `Último pedido recusado: “${esc(rejected.decisionNote)}”` : "O responsável aprova cada pedido, com justificativa."}</div></div></div>`;
}

export function accessCta(s, sol, kind = "primary") {
  if (sol.approval !== "aprovada" || sol.archived) return "";
  const mine = s.requests.filter((r) => r.solutionId === sol.id && r.requesterId === s.userId);
  if (sol.access === "direto" || mine.some((r) => r.status === "aprovada")) return btn("Acessar solução", { kind, action: "openAccess", data: { id: sol.id } });
  if (mine.some((r) => r.status === "pendente")) return btn("Pedido pendente", { kind, attrs: "disabled" });
  return btn("Pedir acesso", { kind, action: "openModal", data: { modal: "request", id: sol.id } });
}

export function side(s, sol) {
  const L = sol.links ?? {};
  const linkRows = [["code", "Repositório", L.repo, true], ["layout", "Aplicação", L.app, true], ["network", "Endpoint", L.endpoint, true], ["book", "Manual de uso", L.docs, false]].filter((r) => r[2]);
  const e = engagement(sol);
  const top = Math.max(e.views, 1);
  const r = avgRating(sol);
  const dist = [5, 4, 3, 2, 1].map((n) => [n, sol.ratings.filter((x) => x.stars === n).length / Math.max(1, sol.ratings.length)]);
  const myRating = sol.ratings.find((x) => x.userId === s.userId);
  const reuse = sol.uses.length ? Math.round((sol.uses.filter((u) => u.reuse).length / sol.uses.length) * 100) : 86;
  const contacts = sol.contacts ?? [sol.ownerId];
  return `<aside class="stack" style="gap:24px">
    <section class="panel">${secHead("Acesso")}${accessBox(s, sol)}
      ${linkRows.map(([ic, l, v, mono]) => `<div class="row"><span class="selo">${icon(ic, { size: 18 })}</span><div class="grow"><div class="small muted">${l}</div><div class="${mono ? "mono" : "small"}" style="color:var(--primary);overflow-wrap:anywhere">${esc(v)}</div></div></div>`).join("")}
      <div class="stack" style="gap:8px">${accessCta(s, sol)}</div></section>
    <section class="panel">${secHead("Impacto e utilização")}
      <div class="row between">${[[int(e.confirmed), "usos confirmados"], [hours(hoursSaved(sol)), "economizadas"], [`${reuse}%`, "reutilizariam"]].map(([n, l]) => `<div><strong style="font-size:24px;font-weight:500;display:block">${n}</strong><span class="small muted">${l}</span></div>`).join("")}</div>
      <hr style="border:0;border-top:1px solid var(--line);margin:0">
      ${[["Aberturas do detalhe", e.views, "grey"], ["Interesse (favoritos e pedidos)", e.interests, "soft"], ["Uso confirmado", e.confirmed, ""]].map(([l, n, cls]) => `<div class="funnel-row"><div class="row"><span>${l}</span><strong style="color:var(--text)">${int(n)}</strong></div>${bar(n / top, cls)}</div>`).join("")}
      <p class="small muted">Só contamos uso quando a pessoa confirma que usou. ${e.interests ? `${conversion(e.confirmed, e.interests)}% do interesse virou uso.` : ""}</p>
      ${sol.approval === "aprovada" ? btn("Confirmar que usei", { kind: "secondary", action: "openModal", data: { modal: "use", id: sol.id } }) : ""}</section>
    <section class="panel">${secHead("Avaliações")}
      <div class="row" style="gap:16px"><strong style="font-size:44px;line-height:48px;font-weight:500">${rating(r)}</strong><div><div style="color:var(--warning);font-size:18px" aria-hidden="true">${"★".repeat(Math.round(r ?? 0))}${"☆".repeat(5 - Math.round(r ?? 0))}</div><span class="small muted">${sol.ratings.length} avaliações</span></div></div>
      ${dist.map(([n, p]) => `<div class="row" style="gap:10px"><span class="small muted" style="width:28px">${n} ★</span><div class="grow">${bar(p, "warning")}</div><span class="small muted" style="width:36px;text-align:right">${Math.round(p * 100)}%</span></div>`).join("")}
      ${(sol.reviews ?? []).map((v) => `<div class="quote">“${esc(v.text)}”<div class="small muted" style="margin-top:6px">${esc(v.who)} · ★ ${v.stars}</div></div>`).join("")}
      ${myRating ? `<div class="quote"><strong>Sua avaliação: ${"★".repeat(myRating.stars)}</strong>${myRating.comment ? `<div class="small">“${esc(myRating.comment)}”</div>` : ""}</div>` : ""}
      ${sol.approval === "aprovada" ? btn(myRating ? "Editar minha avaliação" : "Avaliar esta solução", { kind: "secondary", action: "openModal", data: { modal: "rate", id: sol.id, stars: myRating?.stars ?? 0 } }) : ""}</section>
    <section class="panel">${secHead("Contatos")}${contacts.map((id) => { const u = userById(id); return `<div class="row">${avatar(id)}<div class="grow"><strong style="font-weight:500">${esc(u.name)}</strong><div class="small muted">${id === sol.ownerId ? "Responsável" : esc(u.job)}</div></div><button type="button" class="link sm" data-action="contact" data-name="${esc(u.name)}">Teams</button></div>`; }).join("")}</section>
  </aside>`;
}
