import { anticipationCheck, anticipationValues } from "../actions/index.js";
import { anticipationInUseCents, contractById, draft, isProviderOf } from "../store.js";
import { appbar, btn, card, circle, empty, esc, field, icon, kv, listCard, money, note, row, screen } from "../ui.js";

export const ATTACH = [["photo", "Foto", "camera"], ["video", "Vídeo", "video-camera"], ["document", "Documento", "file-text"], ["location", "Local", "map-pin"]];

function entrega(s, { id, stage }) {
  const c = contractById(s, id);
  const idx = Number(stage);
  const st = c && isProviderOf(c, s) ? c.stages[idx] : null;
  if (!st) return screen({ header: appbar({ title: "Enviar entrega" }), body: empty("Marco não encontrado.") });
  if (draft("entrega.key") !== `${id}:${idx}`) {
    return screen({ header: appbar({ title: "Enviar entrega" }), body: empty("Comece o envio pela página do serviço."), footer: btn("Começar envio", { action: "startDelivery", data: { id, stage } }) });
  }
  const atts = draft("entrega.attachments", []);
  const counts = Object.fromEntries(ATTACH.map(([k]) => [k, atts.filter((a) => a.kind === k).length]));
  const covHtml = `<strong>Itens combinados do marco</strong>${st.items.map((it) => `<div class="check-line muted">${icon("list-checks")}<span>${esc(it)}</span></div>`).join("")}`;
  return screen({
    header: appbar({ title: "Enviar entrega" }),
    body: `${card(`<strong>Marco ${idx + 1} · ${esc(st.name)}</strong><small class="muted">${esc(c.client)} · ${money(st.valueCents)} · até ${esc(st.due)}</small>${st.reply ? `<p class="quote">Pedido de ajuste: “${esc(st.reply.text)}”</p>` : ""}`)}
      ${field("Legenda do próximo anexo", { bind: "entrega.caption", value: draft("entrega.caption", ""), placeholder: `Ex.: ${st.name} pronto` })}
      <div class="attach-grid">${ATTACH.map(([k, l, ic]) => `<button type="button" class="attach ${counts[k] ? "has" : ""}" data-action="addAttachment" data-kind="${k}">${icon(ic)}<strong>${l}</strong><small>${counts[k] ? `${counts[k]} ${counts[k] === 1 ? "item" : "itens"}` : "Adicionar"}</small></button>`).join("")}</div>
      ${atts.length ? listCard("Anexos", atts.map((a, i) => row({ icon: ATTACH.find(([k]) => k === a.kind)[2], title: a.caption, detail: ATTACH.find(([k]) => k === a.kind)[1], action: "removeAttachment", data: { index: i }, tone: "neutral", extra: `<small class="muted">remover</small>` })).join("")) : ""}
      ${card(field("Descrição do que foi feito", { bind: "entrega.description", value: draft("entrega.description"), multiline: true }))}
      ${card(covHtml)}`,
    footer: btn("Enviar para aprovação", { action: "sendDelivery", data: { id, stage } }),
  });
}

function antecipar(s, { id, stage }) {
  const c = contractById(s, id);
  const idx = Number(stage);
  const st = c && isProviderOf(c, s) ? c.stages[idx] : null;
  if (!st) return screen({ header: appbar({ title: "Antecipar", tone: "ink" }), body: empty("Marco não encontrado.") });
  const checks = anticipationCheck(s, c, idx);
  const blocked = checks.some(([, ok]) => !ok);
  if (blocked) {
    return screen({
      header: appbar({ title: "Antecipar", tone: "ink" }),
      body: `<div class="center-block">${circle("lock-simple", "neutral", 56)}<h2>Antecipação indisponível agora</h2><p class="muted">${esc(c.title)} · marco ${idx + 1} · ${money(st.valueCents)}</p></div>
        ${card(`<strong>O que falta</strong>${checks.map(([label, ok, detail]) => `<div class="req ${ok ? "ok" : "no"}">${icon(ok ? "check-circle" : "x")}<div><strong>${esc(label)}</strong>${ok ? "" : `<small>${esc(detail)}</small>`}</div></div>`).join("")}`)}
        ${note("Quando tudo estiver ok, você pode antecipar até 95% do valor do marco.")}`,
      footer: st.status === "inProgress" || st.status === "adjustRequested" ? btn(`Enviar entrega do marco ${idx + 1}`, { action: "startDelivery", data: { id, stage } }) : btn("Voltar ao serviço", { kind: "secondary", go: `#/servico/${id}` }),
    });
  }
  const v = anticipationValues(st);
  const why = checks.slice(1, 5).map(([label]) => `<div class="req ok">${icon("check-circle")}<div><strong>${esc(label)}</strong></div></div>`).join("");
  const acc = s.accounts[s.session.person];
  const freeCents = Math.max(0, (acc?.anticipationLimitCents ?? 0) - anticipationInUseCents(s));
  return screen({
    header: appbar({ title: "Antecipar", tone: "ink" }),
    body: `${card(`<small class="muted">${esc(c.title)} · marco ${idx + 1}</small><div class="amount dark">${money(v.netCents)}</div><small class="muted">cai na sua conta BTG hoje</small>`)}
      ${card(`<strong>Por que você pode antecipar</strong>${why}${kv("Seu limite de antecipação", `${money(freeCents)} livres de ${money(acc?.anticipationLimitCents ?? 0)}`)}<small class="muted">Regra do banco, igual para todos. Esse limite é só seu, separado do limite para pagar.</small>`, "antec-why")}
      ${card(`${kv("Valor do marco", money(st.valueCents))}${kv("Antecipado (95%)", money(v.grossCents))}${kv("Taxa (2,9%)", `− ${money(v.feeCents)}`)}<hr>${kv("Você recebe", money(v.netCents), "pos-text")}`)}
      ${note("Quando a contratante aprovar o marco, o valor guardado quita a antecipação. Se houver disputa, o valor fica bloqueado até a decisão.")}`,
    footer: btn(`Antecipar ${money(v.netCents)}`, { action: "confirmAnticipation", data: { id, stage }, iconName: "lightning" }),
  });
}

function antecipado(s, { id, stage }) {
  const st = contractById(s, id)?.stages[Number(stage)];
  return screen({
    header: appbar({ title: "Antecipação" }),
    body: `<div class="center-block">${circle("lightning", "pos", 64)}<h2>Antecipação feita</h2><div class="amount dark">${money(st?.anticipation?.netCents ?? 0)}</div><p class="muted">Já está na sua conta BTG.</p></div>`,
    footer: btn("Voltar ao início", { go: "#/inicio" }),
  });
}

export const providerRoutes = {
  "entrega/:id/:stage": entrega, "antecipar/:id/:stage": antecipar, "antecipado/:id/:stage": antecipado,
};
