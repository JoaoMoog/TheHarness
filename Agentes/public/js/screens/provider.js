import { anticipationCheck, anticipationValues } from "../actions/index.js";
import { contractById, draft, isProviderOf } from "../store.js";
import {
  appbar, btn, busyNote, card, checkbox, chip, circle, empty, esc, field, icon, kv, listCard, money, note, row, screen,
} from "../ui.js";

const ATTACH = [["photo", "Foto", "camera"], ["video", "Vídeo", "video-camera"], ["document", "Documento", "file-text"], ["location", "Local", "map-pin"]];

function convite(s, { id }) {
  const inv = s.invites.find((i) => i.id === id);
  if (!inv) return screen({ header: appbar({ title: "Convite" }), body: empty("Convite não encontrado.") });
  if (inv.status !== "sent") return screen({ header: appbar({ title: "Convite" }), body: empty(inv.status === "accepted" ? "Convite já aceito." : "Convite recusado."), footer: inv.contractId ? btn("Ver serviço", { go: `#/servico/${inv.contractId}` }) : "" });
  const ask = Boolean(draft("convite.askEntrada"));
  return screen({
    header: appbar({ title: "Convite" }),
    body: `${card(`<div class="row-gap">${circle("user")}<div><strong>${esc(inv.client)} convidou você</strong><small class="muted">${esc(inv.title)} · ${esc(inv.id)}</small></div></div><h2>${money(inv.totalCents)} em ${inv.stages.length} etapa(s)</h2>${inv.stages.map((st) => kv(st.name, money(st.valueCents))).join("")}<p class="small muted">${esc(inv.description)}</p>`)}
      ${card(`${checkbox("Pedir uma entrada para comprar material", { bind: "convite.askEntrada", checked: ask })}${ask ? `${field("Valor da entrada (R$)", { bind: "convite.entrada", value: draft("convite.entrada"), inputmode: "decimal" })}<p class="small warn-text">A entrada sai da etapa 1 e não fica em custódia. A contratante decide se aceita.</p>` : ""}`)}
      ${card(`<div class="row-gap">${icon("gavel")}<strong>Cláusula compromissória</strong></div><p class="small">Se houver disputa sem acordo, a decisão final é de uma câmara de arbitragem independente, custeada pelo seguro de arbitragem.${inv.insurance ? " A contratante incluiu o Seguro Aval da obra." : ""}</p><button type="button" class="link" data-go="#/arbitragem">Como funciona</button>`)}
      ${checkbox("Li e aceito as condições do serviço e a cláusula de arbitragem.", { bind: "convite.terms", checked: draft("convite.terms") })}`,
    footer: `${btn("Aceitar convite", { action: "acceptInvite", data: { id } })}${btn("Recusar", { kind: "text", action: "declineInvite", data: { id } })}`,
  });
}

function entrega(s, { id, stage }) {
  const c = contractById(s, id);
  const idx = Number(stage);
  const st = c && isProviderOf(c, s) ? c.stages[idx] : null;
  if (!st) return screen({ header: appbar({ title: "Enviar entrega" }), body: empty("Etapa não encontrada.") });
  if (draft("entrega.key") !== `${id}:${idx}`) {
    return screen({ header: appbar({ title: "Enviar entrega" }), body: empty("Comece o envio pela página do serviço."), footer: btn("Começar envio", { action: "startDelivery", data: { id, stage } }) });
  }
  const atts = draft("entrega.attachments", []);
  const counts = Object.fromEntries(ATTACH.map(([k]) => [k, atts.filter((a) => a.kind === k).length]));
  const covHtml = `<strong>Itens combinados da etapa</strong>${st.items.map((it) => `<div class="check-line muted">${icon("list-checks")}<span>${esc(it)}</span></div>`).join("")}`;
  return screen({
    header: appbar({ title: "Enviar entrega" }),
    body: `${card(`<strong>Etapa ${idx + 1} · ${esc(st.name)}</strong><small class="muted">${esc(c.client)} · ${money(st.valueCents)} · até ${esc(st.due)}</small>${st.reply ? `<p class="quote">Pedido de ajuste: “${esc(st.reply.text)}”</p>` : ""}`)}
      ${field("Legenda do próximo anexo", { bind: "entrega.caption", value: draft("entrega.caption", ""), placeholder: "Ex.: Piso rejuntado no box" })}
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
  if (!st) return screen({ header: appbar({ title: "Antecipar", tone: "ink" }), body: empty("Etapa não encontrada.") });
  const checks = anticipationCheck(s, c, idx);
  const blocked = checks.some(([, ok]) => !ok);
  if (blocked) {
    return screen({
      header: appbar({ title: "Antecipar", tone: "ink" }),
      body: `<div class="center-block">${circle("lock-simple", "neutral", 56)}<h2>Antecipação indisponível agora</h2><p class="muted">${esc(c.title)} · etapa ${idx + 1} · ${money(st.valueCents)}</p></div>
        ${card(`<strong>O que falta</strong>${checks.map(([label, ok, detail]) => `<div class="req ${ok ? "ok" : "no"}">${icon(ok ? "check-circle" : "x")}<div><strong>${esc(label)}</strong>${ok ? "" : `<small>${esc(detail)}</small>`}</div></div>`).join("")}`)}
        ${note("Quando tudo estiver ok, você pode antecipar até 95% do valor da etapa.")}`,
      footer: st.status === "inProgress" || st.status === "adjustRequested" ? btn(`Enviar entrega da etapa ${idx + 1}`, { action: "startDelivery", data: { id, stage } }) : btn("Voltar ao serviço", { kind: "secondary", go: `#/servico/${id}` }),
    });
  }
  const v = anticipationValues(st);
  return screen({
    header: appbar({ title: "Antecipar", tone: "ink" }),
    body: `${card(`<small class="muted">${esc(c.title)} · etapa ${idx + 1}</small><div class="amount dark">${money(v.netCents)}</div><small class="muted">cai na sua conta Nexo hoje</small>`)}
      ${card(`${kv("Valor da etapa", money(st.valueCents))}${kv("Antecipado (95%)", money(v.grossCents))}${kv("Taxa (2,9%)", `− ${money(v.feeCents)}`)}<hr>${kv("Você recebe", money(v.netCents), "pos-text")}`)}
      ${note("Quando a contratante aprovar a etapa, a custódia quita a antecipação. Se houver disputa, o valor fica bloqueado até a decisão.")}`,
    footer: btn(`Antecipar ${money(v.netCents)}`, { action: "confirmAnticipation", data: { id, stage }, iconName: "lightning" }),
  });
}

function antecipado(s, { id, stage }) {
  const st = contractById(s, id)?.stages[Number(stage)];
  return screen({
    header: appbar({ title: "Antecipação" }),
    body: `<div class="center-block">${circle("lightning", "pos", 64)}<h2>Antecipação feita</h2><div class="amount dark">${money(st?.anticipation?.netCents ?? 0)}</div><p class="muted">Já está na sua conta Nexo.</p></div>`,
    footer: btn("Voltar ao início", { go: "#/inicio" }),
  });
}

function maquininha(s, { id }) {
  const c = contractById(s, id);
  if (!c?.participants || !isProviderOf(c, s)) return screen({ header: appbar({ title: "Maquininha" }), body: empty("A maquininha fica com o prestador de contratos coletivos.") });
  const link = draft("maq");
  const payer = link ? c.participants.find((p) => p.name === link.payer) : null;
  if (!payer) {
    const pending = c.participants.filter((p) => !p.paid);
    return screen({
      header: appbar({ title: "Cobrar na maquininha" }),
      body: `${card(`<strong>${esc(c.title)}</strong><small class="muted">${pending.length} participante(s) sem pagar</small>${pending.map((p) => kv(p.name, money(p.shareCents))).join("")}`)}${note("O valor pago na maquininha entra direto na custódia da etapa, nunca na sua conta.")}`,
      footer: pending.length ? btn("Gerar link e QR", { action: "generateLink", data: { id }, iconName: "qr-code" }) : btn("Voltar", { kind: "secondary", go: `#/servico/${id}` }),
    });
  }
  return screen({
    header: appbar({ title: "Cobrar na maquininha" }),
    body: `${card(`<div class="center-block"><small class="muted">${esc(payer.name)} · ${esc(payer.unit)}</small><div class="amount dark">${money(payer.shareCents)}</div><div class="qr">${icon("qr-code")}</div><p class="small muted">O cliente aproxima o cartão ou lê o código. O valor entra direto na custódia.</p></div>`)}
      ${card(`${kv("Contrato", c.id)}${kv("Origem aceita", "Crédito, débito e Pix")}${kv("Validade do link", "24 horas")}`)}`,
    footer: btn("Simular pagamento com cartão Elo", { action: "simulateCardPayment", data: { id }, iconName: "credit-card" }),
  });
}

export const providerRoutes = {
  "convite/:id": convite, "entrega/:id/:stage": entrega, "antecipar/:id/:stage": antecipar, "antecipado/:id/:stage": antecipado, "maquininha/:id": maquininha,
};
