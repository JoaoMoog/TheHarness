import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { botTurn, incomingCharge, openThread, pixCode } from "../../public/js/domain/wa-bot.js";

const ana = { id: "voce", first: "Ana", clientName: "Ana Ribeiro", providerName: "Ana Ribeiro", phone: "(11) 97777-3003" };
const carlos = { id: "carlos", first: "Carlos", clientName: "Carlos Mendes", providerName: "Horizonte Reformas", phone: "(11) 98888-2002" };
const marina = { id: "marina", first: "Marina", clientName: "Marina Costa", providerName: "Marina Costa Interiores", phone: "(11) 96666-1001" };
const asCarlos = { me: carlos, contacts: [ana, marina] };
const asAna = { me: ana, contacts: [carlos, marina] };

describe("openThread", () => {
  it("greets the person by the name of the BTG account linked to the number", () => {
    const t = openThread(carlos);
    assert.equal(t.step, "idle");
    assert.match(t.messages[0].text, /Carlos/);
    assert.match(t.messages[0].text, /conta BTG/);
  });
});

describe("botTurn · whoever charges", () => {
  it("reads a charge written freely and asks who pays, with the contacts as buttons", () => {
    // Act
    const r = botTurn(openThread(carlos), "Cobrar pintura da varanda, R$ 4.500, entrega 30/11, Rua Harmonia 410", asCarlos);

    // Assert
    assert.equal(r.next.step, "collecting");
    assert.equal(r.next.draft.role, "provider");
    assert.equal(r.next.draft.totalCents, 4_500_00);
    assert.equal(r.next.draft.dueDate, "30/11");
    assert.match(r.next.draft.address, /Rua Harmonia/);
    assert.deepEqual(r.replies.at(-1)?.buttons, ["Ana Ribeiro", "Marina Costa"]);
    assert.equal(r.effect, null);
  });

  it("shows the summary once the contact is chosen, and sends the charge on the button", () => {
    // Arrange
    const first = botTurn(openThread(carlos), "Cobrar pintura da varanda, R$ 4.500, entrega 30/11, Rua Harmonia 410", asCarlos).next;

    // Act
    const summary = botTurn(first, "Ana Ribeiro", asCarlos);
    const sent = botTurn(summary.next, "Enviar cobrança", asCarlos);

    // Assert
    assert.equal(summary.next.step, "confirm");
    assert.ok(summary.replies.some((m) => m.card));
    assert.deepEqual(summary.replies.at(-1)?.buttons, ["Enviar cobrança", "Corrigir"]);
    assert.equal(sent.next.step, "sent");
    assert.deepEqual(sent.effect, {
      kind: "createInvite", role: "provider", counterpartId: "voce", totalCents: 4_500_00, dueDate: "30/11",
      address: "Rua Harmonia 410", description: sent.effect?.description, release: null, stages: [],
    });
    assert.match(String(sent.effect?.description), /Pintura/);
  });

  it("asks for the value when the text has none", () => {
    const r = botTurn(openThread(carlos), "Quero cobrar uma pintura da Ana", asCarlos);
    assert.equal(r.next.step, "collecting");
    assert.match(String(r.replies.at(-1)?.text), /valor/i);
  });

  it("starts over on Corrigir", () => {
    const first = botTurn(openThread(carlos), "Cobrar pintura da Ana, R$ 4.500, até 30/11", asCarlos).next;
    const r = botTurn(first, "Corrigir", asCarlos);
    assert.equal(r.next.step, "idle");
    assert.deepEqual(r.next.draft, {});
  });
});

describe("botTurn · whoever pays", () => {
  it("suggests stages for the kind of service and sends them to the provider", () => {
    // Act
    const r = botTurn(openThread(ana), "Quero pagar a Marina 6 mil pelo projeto de interiores da varanda, até 20/11", asAna);
    const chosen = botTurn(r.next, "Usar marcos", asAna);
    const sent = botTurn(chosen.next, "Enviar para Marina", asAna);

    // Assert
    assert.equal(r.next.step, "stages");
    assert.deepEqual(r.replies.at(-1)?.buttons, ["Usar marcos", "Valor único"]);
    assert.equal(chosen.next.step, "confirm");
    assert.equal(sent.effect?.kind, "createInvite");
    assert.equal(sent.effect?.role, "client");
    assert.equal(sent.effect?.counterpartId, "marina");
    assert.equal(sent.effect?.release, "stages");
    assert.equal(sent.effect?.stages.reduce((a: number, st: { valueCents: number }) => a + st.valueCents, 0), 6_000_00);
  });

  it("can keep one single value instead of stages", () => {
    const r = botTurn(openThread(ana), "Quero pagar a Marina 6 mil pelo projeto de interiores, até 20/11", asAna);
    const single = botTurn(r.next, "Valor único", asAna);
    assert.equal(single.next.draft.release, "single");
    assert.equal(single.next.draft.stages.length, 1);
  });

  it("pays by Pix inside the chat once the provider accepted", () => {
    // Arrange
    const accepted = { ...openThread(ana), step: "awaitingPay", contractId: "AV-2026-009", draft: { totalCents: 6_000_00 } };

    // Act
    const pix = botTurn(accepted, "Pagar com Pix", asAna);
    const paid = botTurn(pix.next, "Já paguei", asAna);

    // Assert
    assert.equal(pix.next.step, "pix");
    assert.ok(pix.replies.some((m) => m.text.includes(pixCode("AV-2026-009", 6_000_00))));
    assert.deepEqual(pix.replies.at(-1)?.buttons, ["Já paguei"]);
    assert.deepEqual(paid.effect, { kind: "payPix", contractId: "AV-2026-009" });
    assert.equal(paid.next.step, "paid");
  });
});

describe("botTurn · questions", () => {
  it("answers a question about the protection without leaving the step", () => {
    const r = botTurn(openThread(ana), "Quanto custa o seguro?", asAna);
    assert.equal(r.next.step, "idle");
    assert.match(r.replies[0].text, /seguro/i);
    assert.equal(r.effect, null);
  });
});

describe("pixCode", () => {
  it("is the same for the same payment and names the amount", () => {
    assert.equal(pixCode("AV-1", 6_000_00), pixCode("AV-1", 6_000_00));
    assert.match(pixCode("AV-1", 6_000_00), /6000\.00/);
  });
});

describe("botTurn · outside the script", () => {
  it("answers a greeting by offering the two things it does, as buttons", () => {
    // Act
    const r = botTurn(openThread(ana), "oi", asAna);

    // Assert
    assert.deepEqual(r.replies.at(-1)?.buttons, ["Cobrar", "Pagar"]);
  });

  it("drops what was being written when the person cancels", () => {
    // Arrange
    const started = botTurn(openThread(carlos), "Cobrar pintura da varanda, R$ 4.500", asCarlos);

    // Act
    const r = botTurn({ ...openThread(carlos), ...started.next }, "cancelar", asCarlos);

    // Assert
    assert.equal(r.next.step, "idle");
    assert.deepEqual(r.next.draft, {});
    assert.deepEqual(r.replies.at(-1)?.buttons, ["Cobrar", "Pagar"]);
  });
});

describe("botTurn · values written without R$", () => {
  it("reads a bare number as the value of the payment", () => {
    // Act
    const r = botTurn(openThread(ana), "quero pagar 500 pra Marina", asAna);

    // Assert
    assert.equal(r.next.draft.totalCents, 500_00);
  });

  it("takes a bare number as the answer when it asked for the value", () => {
    // Arrange
    const asked = botTurn(openThread(carlos), "Cobrar pintura da Ana", asCarlos);

    // Act
    const r = botTurn({ ...openThread(carlos), ...asked.next }, "4.500", asCarlos);

    // Assert
    assert.equal(r.next.draft.totalCents, 4_500_00);
  });

  it("never takes a date, an address number, a phone, installments or a count as the value", () => {
    // Act
    const r = botTurn(openThread(carlos), "Cobrar pintura em 6x, 2 marcos, 20 dias, entrega 30/11, Rua Harmonia 410, tel 11977773003", asCarlos);

    // Assert
    assert.equal(r.next.draft.totalCents ?? null, null);
  });
});

describe("incomingCharge · who receives a charge on WhatsApp", () => {
  const charge = { inviteId: "PG-007", from: "Carlos", title: "Reparo do telhado", description: "Reparo do telhado", totalCents: 7_500_00, dueDate: "30/11", code: "4821" };

  it("tells who charged, the value and the security code, and suggests the stages to choose", () => {
    // Act
    const t = incomingCharge(undefined, charge);

    // Assert
    assert.equal(t.step, "incoming");
    assert.equal(t.draft.inviteId, "PG-007");
    const texts = t.messages.map((m) => m.text).join(" ");
    assert.match(texts, /Carlos te cobrou/);
    assert.match(texts, /4821/);
    assert.deepEqual(t.messages.at(-1)?.buttons, ["Usar marcos", "Valor único"]);
    assert.equal(t.inviteId, undefined, "the chat's own payment stays free for what the person writes");
  });

  it("keeps the messages already in the chat", () => {
    const t = incomingCharge(openThread(ana), charge);
    assert.match(t.messages[0].text, /Oi, Ana/);
    assert.equal(t.step, "incoming");
  });

  it("shows the stages chosen with the terms, and accepts on the button", () => {
    // Arrange
    const chose = botTurn(incomingCharge(undefined, charge), "Usar marcos", asAna);

    // Act
    const accepted = botTurn(chose.next, "Aceitar", asAna);

    // Assert
    assert.equal(chose.next.step, "incomingConfirm");
    assert.match(chose.replies.map((r) => r.text).join(" "), /arbitragem/);
    assert.equal(chose.next.draft.stages.reduce((a: number, st: { valueCents: number }) => a + st.valueCents, 0), 7_500_00);
    assert.equal(accepted.effect?.kind, "acceptInvite");
    assert.equal(accepted.effect?.inviteId, "PG-007");
    assert.equal(accepted.effect?.release, "stages");
    assert.equal(accepted.next.step, "awaitingPay");
    assert.deepEqual(accepted.replies.at(-1)?.buttons, ["Pagar com Pix", "Pagar no app"]);
  });

  it("can take one single value instead of stages", () => {
    const chose = botTurn(incomingCharge(undefined, charge), "Valor único", asAna);
    assert.equal(chose.next.draft.release, "single");
    assert.equal(chose.next.draft.stages.length, 1);
  });

  it("pays by Pix after accepting, once the app gives the payment its id", () => {
    // Arrange
    const accepted = botTurn(botTurn(incomingCharge(undefined, charge), "Usar marcos", asAna).next, "Aceitar", asAna).next;

    // Act
    const pix = botTurn({ ...accepted, contractId: "SV-003" }, "Pagar com Pix", asAna);
    const paid = botTurn(pix.next, "Já paguei", asAna);

    // Assert
    assert.equal(pix.next.step, "pix");
    assert.deepEqual(paid.effect, { kind: "payPix", contractId: "SV-003" });
  });

  it("starts fresh when the person writes something new over a charge received", () => {
    const r = botTurn(incomingCharge(undefined, charge), "Quero pagar a Marina 6 mil pelo projeto de interiores, até 20/11", asAna);
    assert.equal(r.next.draft.role, "client");
    assert.equal(r.next.draft.inviteId, undefined);
  });
});
