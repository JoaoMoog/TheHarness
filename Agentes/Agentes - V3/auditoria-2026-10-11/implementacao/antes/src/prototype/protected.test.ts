import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUTO_RELEASE_DAYS, INSURANCE_RATE, autoReleaseDate, checkoutTotal, insurancePremium, nextStepLine, partialRelease, reminderFor, roleOf, splitByTemplate, stagesFor,
  timelineOf, validateAgreement, securityCode, stageShares,
} from "../../public/js/domain/protected.js";

const TODAY = new Date(2026, 9, 7);
const valid = { description: "Pintura da sala e do quarto", totalCents: 480_000, dueDate: "30/10", address: "Rua Harmonia, 120", release: "single" };

describe("validateAgreement", () => {
  it("accepts a complete single-value agreement", () => {
    assert.deepEqual(validateAgreement(valid, TODAY), []);
  });

  it("lists every missing field in Portuguese", () => {
    // Arrange
    const empty = { description: " ", totalCents: 0, dueDate: "", address: "", release: "x" };

    // Act
    const errors = validateAgreement(empty, TODAY);

    // Assert
    assert.deepEqual(errors, [
      "Descreva o que foi combinado.",
      "Informe o valor combinado.",
      "Informe o prazo de entrega.",
      "Informe o endereço do serviço.",
      "Escolha valor único ou marcos.",
    ]);
  });

  it("rejects a deadline before today and a fractional value", () => {
    const errors = validateAgreement({ ...valid, dueDate: "01/10", totalCents: 10.5 }, TODAY);
    assert.deepEqual(errors, ["Informe o valor combinado.", "O prazo não pode ser antes de hoje."]);
  });

  it("requires at least two stages adding up to the total when released by stages", () => {
    const one = validateAgreement({ ...valid, release: "stages", stages: [{ name: "Tudo", valueCents: 480_000 }] }, TODAY);
    const wrongSum = validateAgreement({ ...valid, release: "stages", stages: [{ name: "A", valueCents: 100_000 }, { name: "B", valueCents: 100_000 }] }, TODAY);
    const ok = validateAgreement({ ...valid, release: "stages", stages: splitByTemplate(480_000, "pintura") }, TODAY);
    assert.deepEqual(one, ["Divida em pelo menos dois marcos."]);
    assert.deepEqual(wrongSum, ["Os marcos devem somar o valor combinado."]);
    assert.deepEqual(ok, []);
  });
});

describe("stagesFor", () => {
  it("makes one stage with the whole value for a single release", () => {
    assert.deepEqual(stagesFor(480_000, "single"), [{ name: "Serviço completo", valueCents: 480_000 }]);
  });

  it("splits by the template and always adds up to the total", () => {
    const stages = stagesFor(1_000_001, "stages", "banheiro");
    assert.equal(stages.length, 3);
    assert.equal(stages.reduce((sum, st) => sum + st.valueCents, 0), 1_000_001);
  });

  it("refuses an unknown template", () => {
    assert.throws(() => stagesFor(100_000, "stages", "nada"), RangeError);
  });
});

describe("roleOf", () => {
  const contract = { client: "Ana Ribeiro", provider: "Horizonte Reformas", participants: [{ name: "Ana Ribeiro" }, { name: "Marina Costa" }] };

  it("tells who receives, who pays and who pays a share", () => {
    assert.equal(roleOf(contract, ["Carlos Lima", "Horizonte Reformas"]), "payee");
    assert.equal(roleOf(contract, ["Ana Ribeiro"]), "payer");
    assert.equal(roleOf(contract, ["Marina Costa"]), "splitPayer");
    assert.equal(roleOf(contract, ["Pedro"]), null);
  });
});

describe("autoReleaseDate", () => {
  it("is the delivery day plus the automatic release window", () => {
    assert.equal(AUTO_RELEASE_DAYS, 7);
    assert.deepEqual(autoReleaseDate(TODAY), new Date(2026, 9, 14));
  });
});

describe("timelineOf", () => {
  const base = {
    status: "active", signedAt: "05/10", totalCents: 480_000,
    stages: [
      { name: "Preparo", valueCents: 240_000, status: "released", releasedAt: "06/10", releaseMode: "Aprovação manual" },
      { name: "Acabamento", valueCents: 240_000, status: "awaitingApproval", delivery: { deadline: "12/10" } },
    ],
  };

  it("shows agreed, paid, each stage and the end, with the automatic release countdown", () => {
    // Act
    const steps = timelineOf(base, TODAY);

    // Assert
    assert.deepEqual(steps.map((st) => [st.key, st.state]), [["agreed", "done"], ["paid", "done"], ["stage-0", "done"], ["stage-1", "current"], ["done", "next"]]);
    assert.equal(steps[3].detail, "Entregue. Liberação automática em 5 dias");
  });

  it("waits on payment before any stage starts", () => {
    const steps = timelineOf({ ...base, status: "awaitingPayment", stages: base.stages.map((st) => ({ ...st, status: "pending" })) }, TODAY);
    assert.deepEqual(steps.map((st) => st.state), ["done", "current", "next", "next", "next"]);
  });

  it("flags a disputed stage and a tacit release", () => {
    const steps = timelineOf({
      ...base,
      stages: [{ ...base.stages[0], releaseMode: "Confirmação tácita (prazo sem resposta)" }, { ...base.stages[1], status: "disputed" }],
    }, TODAY);
    assert.equal(steps[2].detail, "Liberado sozinho em 06/10");
    assert.equal(steps[3].state, "alert");
  });

  it("names a single release just as the delivery", () => {
    const steps = timelineOf({ ...base, status: "completed", stages: [{ ...base.stages[0], name: "Serviço completo" }] }, TODAY);
    assert.equal(steps[2].label, "Entrega do serviço");
    assert.equal(steps.at(-1)?.state, "done");
  });
});

describe("checkoutTotal", () => {
  it("adds the optional insurance premium to what is paid", () => {
    assert.equal(insurancePremium(400_000), Math.round(400_000 * INSURANCE_RATE));
    assert.deepEqual(checkoutTotal({ totalCents: 400_000, insured: true, method: "pix" }), { premiumCents: 10_000, payCents: 410_000, plan: null });
    assert.deepEqual(checkoutTotal({ totalCents: 400_000, insured: false, method: "balance" }), { premiumCents: 0, payCents: 400_000, plan: null });
  });

  it("prices the card plan over the value with the premium", () => {
    const result = checkoutTotal({ totalCents: 400_000, insured: true, method: "card", cardCount: 6 });
    assert.equal(result.plan?.count, 6);
    assert.equal(result.payCents, result.plan?.totalCents);
    assert.ok(result.payCents > 410_000);
  });
});

describe("partialRelease", () => {
  it("releases part of the stage and keeps the rest guarded", () => {
    assert.deepEqual(partialRelease(800_000, 600_000), { releaseCents: 600_000, holdCents: 200_000 });
  });

  it("needs a whole amount greater than zero and smaller than the stage", () => {
    for (const bad of [0, 800_000, 900_000, 10.5]) assert.throws(() => partialRelease(800_000, bad), RangeError);
  });
});

describe("reminderFor", () => {
  it("reminds the payer two days and one day before the automatic release", () => {
    assert.deepEqual(reminderFor("12/10", new Date(2026, 9, 10)), { daysLeft: 2 });
    assert.deepEqual(reminderFor("12/10", new Date(2026, 9, 11)), { daysLeft: 1 });
  });

  it("stays quiet before that and on the release day", () => {
    assert.equal(reminderFor("12/10", new Date(2026, 9, 7)), null);
    assert.equal(reminderFor("12/10", new Date(2026, 9, 12)), null);
  });
});

describe("nextStepLine", () => {
  const stages = [
    { name: "Preparo", valueCents: 400_000, status: "inProgress", due: "19/10" },
    { name: "Acabamento", valueCents: 400_000, status: "pending", due: "03/11" },
  ];
  const base = { status: "active", client: "Ana", provider: "Carlos", stages };

  it("says what happens now for each side while a stage is being done", () => {
    assert.equal(nextStepLine(base, "payer", TODAY), "Agora: Carlos faz o marco 1. Prazo 19/10.");
    assert.equal(nextStepLine(base, "payee", TODAY), "Agora: fazer e entregar o marco 1. Prazo 19/10.");
  });

  it("counts the days to the automatic release once the stage is delivered", () => {
    const delivered = { ...base, stages: [{ ...stages[0], status: "awaitingApproval", delivery: { deadline: "12/10" } }, stages[1]] };
    assert.equal(nextStepLine(delivered, "payer", TODAY), "Agora: aprovar o marco 1. Libera sozinho em 5 dias.");
    assert.equal(nextStepLine(delivered, "payee", TODAY), "Agora: Ana confere o marco 1. Libera até 12/10.");
  });

  it("covers payment, a single delivery, a dispute and the end", () => {
    assert.equal(nextStepLine({ ...base, status: "awaitingPayment" }, "payer", TODAY), "Agora: pagar para guardar o dinheiro.");
    assert.equal(nextStepLine({ ...base, status: "awaitingPayment" }, "payee", TODAY), "Agora: esperando Ana pagar.");
    assert.equal(nextStepLine({ ...base, stages: [{ ...stages[0], due: "30/10" }] }, "payer", TODAY), "Agora: Carlos faz o serviço. Prazo 30/10.");
    assert.equal(nextStepLine({ ...base, stages: [{ ...stages[0], status: "disputed" }, stages[1]] }, "payer", TODAY), "Agora: disputa em andamento. O valor do marco 1 está bloqueado.");
    assert.equal(nextStepLine({ ...base, status: "completed" }, "payer", TODAY), "Concluído. Tudo liberado.");
  });
});

describe("securityCode", () => {
  it("gives the same four digits for the same link and different ones for other links", () => {
    // Act
    const first = securityCode("PG-001");

    // Assert
    assert.match(first, /^\d{4}$/);
    assert.equal(securityCode("PG-001"), first);
    assert.notEqual(securityCode("PG-002"), first);
  });
});

describe("stageShares", () => {
  it("gives each milestone its whole percentage of the total", () => {
    const shares = stageShares([{ valueCents: 6_400_00 }, { valueCents: 9_600_00 }]);
    assert.deepEqual(shares, [40, 60]);
  });

  it("always adds up to 100, giving the rounding to the largest remainders", () => {
    // Arrange
    const thirds = [{ valueCents: 1_000_00 }, { valueCents: 1_000_00 }, { valueCents: 1_000_00 }];

    // Act
    const shares = stageShares(thirds);

    // Assert
    assert.equal(shares.reduce((a, b) => a + b, 0), 100);
    assert.deepEqual(shares, [34, 33, 33]);
  });

  it("returns zeros when there is no value yet", () => {
    assert.deepEqual(stageShares([{ valueCents: 0 }, { valueCents: 0 }]), [0, 0]);
  });
});
