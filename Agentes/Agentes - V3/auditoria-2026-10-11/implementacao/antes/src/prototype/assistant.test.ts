import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FAQ, answer, classify, disputeBrief, frontLoad, improveDescription, parseConversation, reviewDelivery, suggestStages } from "../../public/js/domain/assistant.js";

const sum = (stages: { valueCents: number }[]) => stages.reduce((a, st) => a + st.valueCents, 0);

describe("classify", () => {
  it("finds the kind of service from the words used", () => {
    assert.equal(classify("Reforma da cozinha com troca de piso")?.key, "cozinha");
    assert.equal(classify("pintar a sala e o quarto")?.key, "pintura");
    assert.equal(classify("trocar a fiação do apartamento")?.key, "eletrica");
    assert.equal(classify("conserto do relógio"), null);
  });
});

describe("suggestStages", () => {
  it("suggests the stages of the kind of service, adding up to the total", () => {
    // Act
    const s = suggestStages({ description: "Reforma da cozinha", totalCents: 2_000_001 });

    // Assert
    assert.equal(s.release, "stages");
    assert.equal(s.title, "Reforma da cozinha");
    assert.equal(s.stages.length, 4);
    assert.equal(sum(s.stages), 2_000_001);
  });

  it("suggests a single value for small services", () => {
    const s = suggestStages({ description: "Pintura do muro", totalCents: 150_000 });
    assert.equal(s.release, "single");
    assert.deepEqual(s.stages, [{ name: "Serviço completo", valueCents: 150_000 }]);
  });

  it("falls back to start, middle and end when the service is unknown", () => {
    const s = suggestStages({ description: "Conserto geral", totalCents: 900_000 });
    assert.deepEqual(s.stages.map((st) => st.name), ["Início", "Execução", "Entrega final"]);
    assert.equal(sum(s.stages), 900_000);
  });

  it("can split into more or fewer stages when asked", () => {
    assert.equal(suggestStages({ description: "Reforma da cozinha", totalCents: 2_000_000, count: 2 }).stages.length, 2);
  });
});

describe("parseConversation", () => {
  it("reads the agreed value, the deadline, the address and the service from a chat", () => {
    // Arrange
    const chat = `Cliente: Oi Carlos, quanto fica a pintura do apartamento?
Carlos: Fica R$ 17.000,00 com massa corrida.
Cliente: Consegue por R$ 16.000,00?
Carlos: Fechado. Entrego até 03/11.
Cliente: Ótimo, é na Rua Harmonia, 410.`;

    // Act
    const found = parseConversation(chat);

    // Assert
    assert.equal(found.totalCents, 1_600_000);
    assert.equal(found.dueDate, "03/11");
    assert.equal(found.address, "Rua Harmonia, 410");
    assert.match(found.description, /pintura/i);
  });

  it("understands values written as thousands", () => {
    assert.equal(parseConversation("fechamos em 18 mil").totalCents, 1_800_000);
  });

  it("leaves out what it did not find", () => {
    const found = parseConversation("oi, tudo bem?");
    assert.equal(found.totalCents, null);
    assert.equal(found.dueDate, null);
  });
});

describe("answer", () => {
  it("answers questions about the protection by topic", () => {
    assert.equal(answer("o que acontece se eu não aprovar?").topic, "autoRelease");
    assert.equal(answer("quanto custa o seguro?").topic, "insurance");
    assert.equal(answer("posso parcelar?").topic, "installments");
    assert.equal(answer("como funcionam as etapas").topic, "stages");
    assert.equal(answer("como funcionam os marcos").topic, "stages");
    assert.equal(answer("e se o serviço ficar ruim?").topic, "dispute");
  });

  it("says what it can help with when it does not know", () => {
    assert.equal(answer("qual a capital da França?").topic, "unknown");
  });
});

describe("FAQ", () => {
  it("asks each question in words the assistant answers with the same text", () => {
    assert.ok(FAQ.length > 0);
    for (const item of FAQ) assert.deepEqual(answer(item.question), { topic: item.topic, text: item.text });
  });
});

describe("reviewDelivery", () => {
  it("approves a delivery with photos and a description of the stage", () => {
    const r = reviewDelivery({ stageName: "Preparo e massa", delivery: { description: "Massa corrida e preparo das paredes concluídos.", attachments: [{ kind: "photo" }] } });
    assert.equal(r.ok, true);
  });

  it("points out a delivery without photos or that does not mention the stage", () => {
    const r = reviewDelivery({ stageName: "Instalações", delivery: { description: "Pronto.", attachments: [{ kind: "document" }] } });
    assert.equal(r.ok, false);
    assert.equal(r.notes.filter((n) => n.tone === "warn").length, 2);
  });
});

describe("disputeBrief", () => {
  it("summarizes both sides and the proposal by the rule", () => {
    const brief = disputeBrief({ report: "Ficou manchada.", reasonLabel: "Qualidade da entrega", clientEvidence: ["3 fotos"], providerStatement: "Entreguei certo.", providerEvidence: [], amountCents: 800_000, share: 0.65 });
    assert.equal(brief.lines.length, 3);
    assert.match(brief.suggestion, /65%/);
  });
});

describe("classify priority", () => {
  it("reads a design project that names rooms as interiors, not as a renovation", () => {
    assert.equal(classify("projeto de interiores da sala e da cozinha")?.key, "interiores");
  });
});

describe("improveDescription", () => {
  it("names the kind of service and says what it includes", () => {
    // Act
    const out = improveDescription("  pintar o apartamento   todo ");

    // Assert
    assert.equal(out.text, "Pintura: pintar o apartamento todo. Inclui preparo e massa corrida, selador e duas demãos.");
    assert.equal(out.title, "Pintura");
  });

  it("only tidies a text that is already organized or of an unknown kind", () => {
    assert.equal(improveDescription("conserto do portão").text, "Conserto do portão.");
    assert.equal(improveDescription("Pintura: sala e quarto").text, "Pintura: sala e quarto.");
  });

  it("returns nothing for an empty text", () => {
    assert.deepEqual(improveDescription("   "), { text: "", title: "" });
  });
});

describe("improveDescription without repeating", () => {
  it("does not add what the person already wrote", () => {
    assert.equal(improveDescription("pintar o apartamento todo, massa corrida e duas demãos").text, "Pintura: pintar o apartamento todo, massa corrida e duas demãos.");
  });
});

describe("frontLoad", () => {
  it("puts 60% in the first stage for the material and spreads the rest like before", () => {
    // Arrange
    const stages = [{ name: "Preparo e massa", valueCents: 8_000_00 }, { name: "Pintura e acabamento", valueCents: 8_000_00 }];

    // Act
    const out = frontLoad(stages, 16_000_00);

    // Assert
    assert.equal(out[0].valueCents, 9_600_00);
    assert.equal(out[1].valueCents, 6_400_00);
    assert.equal(sum(out), 16_000_00);
    assert.deepEqual(out.map((st) => st.name), ["Preparo e massa", "Pintura e acabamento"]);
  });

  it("keeps whole reais and the exact total across three stages", () => {
    const out = frontLoad([{ name: "A", valueCents: 1 }, { name: "B", valueCents: 1 }, { name: "C", valueCents: 1 }], 10_000_01);
    assert.equal(sum(out), 10_000_01);
    assert.equal(out[0].valueCents % 100, 0);
  });

  it("leaves a single stage as it is", () => {
    const one = [{ name: "Serviço completo", valueCents: 2_000_00 }];
    assert.deepEqual(frontLoad(one, 2_000_00), one);
  });
});
