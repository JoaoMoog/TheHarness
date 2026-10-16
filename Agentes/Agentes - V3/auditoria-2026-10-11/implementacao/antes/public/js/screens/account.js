// Connect the BTG account (consent, token), Open Finance, connected accounts and the BTG Banking entry point.
import { account, availableLimitCents, myContracts } from "../store.js";
import { appbar, btn, card, circle, icon, listCard, money, row, screen } from "../ui.js";
import { bkBanner, bkHeader, bkItem, bkSection, bkStrip, todayLabel } from "./btg-kit.js";
import { shown } from "./chrome.js";

function semConta() {
  return screen({
    header: appbar({ title: "Sem conta BTG" }),
    body: `<div class="center-block">${circle("bank", "info", 64)}<h2>Você ainda pode usar o Aval</h2><p class="muted">Sem conta, você paga à vista com Pix de qualquer banco e o dinheiro continua guardado.</p></div>
      ${listCard("", `${row({ icon: "check-circle", title: "Valor guardado por marco", detail: "Disponível", tone: "pos" })}${row({ icon: "x", title: "Crédito para contratar", detail: "Precisa de conta BTG", tone: "neutral" })}${row({ icon: "x", title: "Antecipação de recebíveis", detail: "Precisa de conta BTG", tone: "neutral" })}`)}
      ${card(`<strong>Abra sua conta em minutos</strong><small class="muted">Conta digital BTG, sem tarifa. Documento e selfie.</small>${btn("Abrir conta BTG", { kind: "secondary small", go: "#/cadastro" })}`, "soft")}`,
    footer: btn("Seguir só à vista", { kind: "secondary", action: "useCashOnly" }),
  });
}

function btgBanking(s) {
  const acc = account(s);
  const ids = new Set(myContracts(s).map((c) => c.id));
  const activity = s.ledger.filter((l) => ids.has(l.contractId)).slice(0, 3).map((l) => bkItem({
    icon: "seal-check", label: l.amountCents < 0 ? "Aval · liberação do valor guardado" : "Aval · entrada no valor guardado", title: l.label,
    value: `${l.amountCents < 0 ? "−" : "+"} ${money(Math.abs(l.amountCents))}`, go: "#/extrato",
  }));
  return screen({
    cls: "bk", dark: true,
    body: `${bkHeader(s, {
      title: "Conta corrente", label: "Saldo atual", cents: acc?.balanceCents ?? 0, sub: "Você usou 0 de 10 dias sem juros no limite.",
      lines: [["Empréstimo na hora no Aval", shown(s, availableLimitCents(s)), "#/financeiro"], ["Open Finance", acc?.openFinance.status === "shared" ? "Ver bancos" : "Conectar", "#/btg"]],
      cta: { label: "Ir para extrato", go: "#/extrato" },
    })}
      ${bkStrip([["Pix e transferir", "qr-code", "#/btg"], ["Aval", "seal-check", "#/inicio"], ["Pagar", "receipt", "#/btg"], ["Cartões", "credit-card", "#/btg"]])}
      ${bkBanner({ text: "Pague o serviço que você combinou com o dinheiro guardado até a entrega. Conheça o Aval, a nova forma de pagar serviços.", cta: "Abrir o Aval", art: "shield-check", go: "#/inicio" })}
      ${bkSection("Atividades", activity, { aside: `<span class="bk-day">${todayLabel()}</span>`, empty: "Nenhuma atividade hoje." })}`,
  });
}

export const accountRoutes = { "sem-conta": semConta, btg: btgBanking };
