// Switches without fine print: turning one on opens a short window to read and confirm; turning it off is one tap.
import { redeemFor } from "../domain/points.js";
import { insurancePremium } from "../domain/protected.js";
import { contractById } from "../store.js";
import { btn, circle, esc, money, sheet } from "../ui.js";

/** One line: icon, title, an optional value, and the switch. Off asks for confirmation; on turns off directly. */
export function switchRow({ ic, title, value = "", on, kind, id = "", off }) {
  const target = id ? ` data-id="${esc(id)}"` : "";
  const attrs = on ? `data-action="${off}"${target}` : `data-action="askConfirm" data-kind="${kind}"${target}`;
  return `<div class="toggle-row switch-row">${circle(ic, on ? "pos" : "neutral", 32)}<strong>${esc(title)}</strong>${value ? `<span class="switch-value">${esc(value)}</span>` : ""}<button type="button" class="toggle ${on ? "on" : ""}" role="switch" aria-checked="${on}" aria-label="${esc(title)}" ${attrs}><span></span></button></div>`;
}

/** What each switch means, said once, in the window the person confirms. */
const TEXTS = {
  repeat: () => ["Repetir todo mês?", "A cobrança se repete todo mês. Cada mês é pago por Pix Automático, fica guardado e libera quando o cliente aprovar, ou sozinho em 3 dias.", "Repetir todo mês"],
  insurance: (s, id) => {
    const c = contractById(s, id);
    return ["Contratar o seguro?", `Custa ${money(insurancePremium(c.totalCents))} a mais. Se uma disputa terminar a seu favor, ele cobre o que já foi liberado ou outro prestador para terminar. Franquia de 10%.`, "Contratar seguro"];
  },
  points: (s, id) => {
    const c = contractById(s, id);
    const { points, cents } = redeemFor(s.points?.[s.session.person] ?? 0, c.totalCents - c.paidInCents);
    return ["Usar seus pontos?", `${points.toLocaleString("pt-BR")} pontos viram ${money(cents)} de desconto. O desconto volta para o seu saldo depois do pagamento.`, "Usar pontos"];
  },
  autoAnticipate: () => ["Receber antes, sempre?", "A cada entrega enviada, você recebe 95% na hora, com taxa de 2,9%. Quem paga continua aprovando do mesmo jeito.", "Ligar"],
  pixAuto: () => ["Ligar o Pix Automático?", "As parcelas do empréstimo são pagas no vencimento com o saldo da conta. Você não paga atrasado e sua nota melhora.", "Ligar"],
};

function confirmSheet(s) {
  const { kind, id } = s.ui.sheet;
  const [title, text, cta] = TEXTS[kind](s, id);
  return sheet(title, `<p class="confirm-text">${esc(text)}</p>${btn(cta, { action: "confirmToggle" })}${btn("Agora não", { kind: "text", action: "closeSheet" })}`);
}

export const confirmSheets = { confirmar: confirmSheet };
