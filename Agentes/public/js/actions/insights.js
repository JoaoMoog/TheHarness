// Bank website tools: structured funding, collusion blocks, ELO Marketplace sandbox and the Jev threshold simulator.
import { addDays, audit, custodyCents, getState, makeStage, nextId, notify, setDraft, today, update } from "../store.js";
import { money } from "../ui.js";
import { actions as A, ok, warn } from "./core.js";

export const FUNDING = { name: "FIDC Aval Recebíveis I", seniorShare: 0.8, seniorRate: "CDI + 1,9% a.a.", subordinateRate: "CDI + 6,5% a.a.", structuringFee: 0.015 };

const BOOK_CREDIT_CENTS = 3_820_000_000;
const BOOK_CUSTODY_CENTS = 480_000_000;

/** Eligible book: the bank's Aval credit and custody, plus what this demo added. */
export function fundingBook(s) {
  const credit = BOOK_CREDIT_CENTS + s.credits.filter((c) => c.status === "active").reduce((a, c) => a + c.principalCents, 0);
  const custody = BOOK_CUSTODY_CENTS + s.contracts.reduce((a, c) => a + custodyCents(c), 0);
  return { credit, custody, total: credit + custody };
}
A.issueFunding = () => {
  const s0 = getState();
  if (s0.funding.issued) return warn("O fundo já foi emitido nesta demonstração.");
  const { total } = fundingBook(s0);
  update((s) => {
    s.funding = { issued: true, volumeCents: total, feeCents: Math.round(total * FUNDING.structuringFee), at: today() };
    audit(s, "Luiza Prado · tesouraria", "Emissão de funding", `${FUNDING.name} · ${money(total)}`, "FIDC");
  });
  ok(`${FUNDING.name} emitido e distribuído para investidores Nexo.`);
};

A.blockPair = ({ pair }) => {
  update((s) => {
    s.blacklist.unshift({ kind: "Par", value: pair, reason: `Padrão de conluio · ${today()}` });
    audit(s, "Luiza Prado · antifraude", "Bloqueio de par", pair, "conluio");
  });
  ok(`${pair}: bloqueado para novas operações. A decisão pode ser contestada pelos clientes.`);
};

/** Sandbox of the ELO Marketplace integration: a task closed there arrives here as a contract to fund. */
A.simulateEloContract = () => {
  update((s) => {
    const id = nextId("AV-2026-", s.contracts.map((c) => c.id));
    s.contracts.unshift({
      id, title: "Paisagismo do quintal", client: "Marina Costa", provider: "Jardim Vivo Paisagismo", kind: "individual", origin: "ELO Marketplace",
      description: "Projeto e plantio do quintal, contratado pelo ELO Marketplace.", address: "Rua das Acácias, 120 · São Paulo",
      totalCents: 520_000, status: "awaitingPayment", signedAt: today(), arbitration: true, paidInCents: 0, refundedCents: 0, payment: null, entrada: null,
      insurance: null, arbitrationFeeCents: 2_080,
      stages: [makeStage("Projeto e preparo do solo", 200_000, addDays(10), "pending", ["Projeto aprovado", "Solo preparado"]), makeStage("Plantio e irrigação", 320_000, addDays(25), "pending", ["Mudas plantadas", "Irrigação instalada"])],
    });
    s.apiEvents.unshift({ at: today(), source: "ELO Marketplace", event: "contract.created", ref: id });
    notify(s, "Marina Costa", "Contrato vindo do ELO Marketplace", "Paisagismo do quintal · pague para começar", "link", `#/pagar/${id}`, "contratante");
    audit(s, "API ELO Marketplace", "Contrato recebido", `${id} · R$ 5.200,00 · 2 marcos`, id);
  });
  ok("Contrato recebido pela API. Marina já pode pagar no app.");
};

A.setThreshold = ({ judgment, value }) => setDraft(`limiar.${judgment}`, Number(value), false);
A.setLabs = ({ key, value }) => setDraft(`labs.${key}`, Number(value), false);
