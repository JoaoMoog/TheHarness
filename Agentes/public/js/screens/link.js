// Card machine (POS) start and the Aval Link web checkout: clients pay into custody without the app.
import { splitByTemplate } from "../actions/index.js";
import { draft, myName } from "../store.js";
import { appbar, btn, card, checkbox, chip, circle, empty, esc, field, icon, kv, money, note, screen } from "../ui.js";

const SPLITS = [["unica", "Tudo na entrega"], ["pintura", "2 etapas: 50% e 50%"], ["banheiro", "3 etapas: 30%, 40% e 30%"]];

function posTerminal(body) {
  return `<div class="pos-device"><div class="pos-head"><img src="/img/btg-logo-white.png" alt="BTG Pactual"><span>Maquininha</span></div><div class="pos-screen">${body}</div><div class="pos-keys">${[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, ""].map((k) => `<span>${k}</span>`).join("")}</div></div>`;
}

function pos(s) {
  const step = draft("pos.step", "form");
  const total = draft("pos.total");
  if (step === "offer") {
    return screen({
      header: appbar({ title: "Maquininha" }),
      body: `${note("Vire a maquininha para o cliente.", "info", "device-mobile")}${posTerminal(`<strong>${esc(myName(s))}</strong><small>oferece um serviço a você</small><h3>${esc(draft("pos.title"))}</h3><div class="pos-amount">R$ ${esc(total)}</div><small>Seu dinheiro fica protegido no Nexo e só é liberado quando você aprovar cada etapa.</small>`)}`,
      footer: `${btn("Cliente aceita os termos", { action: "posAccept", iconName: "check-circle" })}${btn("Voltar", { kind: "text", action: "posStep", data: { step: "form" } })}`,
    });
  }
  if (step === "sent") {
    const id = draft("pos.linkId");
    return screen({
      header: appbar({ title: "Maquininha" }),
      body: `${posTerminal(`${icon("check-circle")}<h3>Termos aceitos</h3><small>Link enviado por SMS e WhatsApp para ${esc(draft("pos.phone"))}</small>`)}${note("O cliente monta as etapas e paga no celular. O cadastro completo acontece depois, pelo link.", "info", "link")}`,
      footer: `${btn("Abrir no celular do cliente", { go: `#/link/${id}` })}${btn("Nova cobrança", { kind: "text", action: "posReset" })}`,
    });
  }
  return screen({
    header: appbar({ title: "Maquininha" }),
    body: `<div class="center-block">${circle("device-mobile", "info", 56)}<h2>Comece o serviço na maquininha</h2><p class="muted">Ofereça na hora, na frente do cliente. Ele aceita no terminal e recebe um link para continuar no celular.</p></div>
      ${card(`${field("Serviço", { bind: "pos.title", value: draft("pos.title") })}${field("Valor (R$)", { bind: "pos.total", value: total, inputmode: "decimal" })}${field("Celular do cliente", { bind: "pos.phone", value: draft("pos.phone"), inputmode: "tel" })}`)}
      ${note("A taxa da maquininha (MDR) só vale para pagamento com cartão. Por Pix, sem taxa.", "info", "percent")}`,
    footer: btn("Mostrar ao cliente", { action: "posStep", data: { step: "offer" }, iconName: "device-mobile" }),
  });
}

/** Public web checkout: looks like the mobile browser, because the client does not have the app yet. */
function linkCheckout(s, { id }) {
  const l = s.links.find((x) => x.id === id);
  const bar = `<div class="browser-bar">${icon("lock-simple")}<span>aval.banconexo.com.br/l/${esc(id)}</span></div>`;
  if (!l) return screen({ header: bar, body: empty("Link não encontrado ou expirado.") });
  if (l.status === "paid") {
    return screen({
      header: bar, cls: "web-checkout",
      body: `<div class="center-block"><img src="/img/btg-logo-navy.png" alt="BTG Pactual" class="logo-md">${circle("lock-simple", "pos", 64)}<h2>Pagamento protegido</h2><div class="amount dark">${money(l.totalCents)}</div><p class="muted">${esc(l.client)}, o valor está em custódia no Nexo. ${esc(l.provider)} recebe a cada etapa que você aprovar.</p></div>
        ${card(`<strong>Acompanhe pelo app Nexo</strong><small class="muted">Aprove etapas, abra disputas e veja o comprovante.</small>${btn("Baixar o app", { kind: "secondary small", go: "#/nexo" })}`, "soft")}`,
    });
  }
  const template = draft("lk.template", "unica");
  const stages = splitByTemplate(l.totalCents, template);
  return screen({
    header: bar, cls: "web-checkout",
    body: `<img src="/img/btg-logo-navy.png" alt="BTG Pactual" class="logo-md">
      ${card(`<small class="muted">${esc(l.provider)} · ${l.via === "pos" ? "iniciado na maquininha" : "Aval Link"}</small><h2>${esc(l.title)}</h2><div class="amount dark">${money(l.totalCents)}</div>${chip("Dinheiro protegido até você aprovar", "pos")}`)}
      <h3>Como liberar o pagamento</h3><div class="choice-list wrap">${SPLITS.map(([k, label]) => `<button type="button" class="pill-option ${template === k ? "on" : ""}" data-action="chooseLinkTemplate" data-key="${k}">${esc(label)}</button>`).join("")}</div>
      ${card(stages.map((st, i) => kv(`${i + 1}. ${st.name}`, money(st.valueCents))).join(""))}
      ${card(field("Seu nome completo", { bind: "lk.name", value: draft("lk.name") }))}
      ${checkbox("Aceito os termos do Aval e a cláusula compromissória de arbitragem.", { bind: "lk.terms", checked: draft("lk.terms") })}`,
    footer: btn(`Pagar ${money(l.totalCents)} com Pix`, { action: "payLink", data: { id }, iconName: "qr-code" }),
  });
}

export const linkRoutes = { pos, "link/:id": linkCheckout };
