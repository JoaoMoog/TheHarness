/** Synthetic demo case AV-2026-001. No real customer data. Money in cents. */
export type StageStatus = "released" | "awaitingApproval" | "locked" | "disputed";

export interface Stage {
  readonly name: string;
  readonly valueCents: number;
  readonly dueDate: string;
  readonly status: StageStatus;
  readonly items: readonly string[];
}

export interface ServiceContract {
  readonly id: string;
  readonly client: string;
  readonly provider: string;
  readonly description: string;
  readonly totalCents: number;
  readonly stages: readonly Stage[];
  readonly payment: {
    readonly method: "pix" | "avalCredit";
    readonly installments: { readonly count: number; readonly valueCents: number; readonly cetAnnual: number };
  };
}

export const AV_2026_001: ServiceContract = {
  id: "AV-2026-001",
  client: "Marina Costa",
  provider: "Horizonte Reformas",
  description:
    "Reforma completa do banheiro: demolição, troca de instalações hidráulicas e elétricas, revestimento e louças.",
  totalCents: 1_200_000,
  stages: [
    {
      name: "Demolição e preparo",
      valueCents: 360_000,
      dueDate: "2026-10-20",
      status: "released",
      items: ["Demolição do revestimento antigo", "Retirada do entulho"],
    },
    {
      name: "Instalações",
      valueCents: 480_000,
      dueDate: "2026-11-10",
      status: "awaitingApproval",
      items: [
        "Tubulação hidráulica trocada",
        "Quadro elétrico novo",
        "Pontos de tomada e luz",
        "Teste de pressão registrado",
      ],
    },
    {
      name: "Acabamento",
      valueCents: 360_000,
      dueDate: "2026-11-30",
      status: "locked",
      items: [
        "Revestimento de parede aplicado",
        "Piso assentado e rejuntado",
        "Louças e metais instalados",
        "Nota fiscal dos materiais",
      ],
    },
  ],
  payment: {
    method: "avalCredit",
    installments: { count: 6, valueCents: 215_302, cetAnnual: 0.2905 },
  },
};

export function sumStages(contract: ServiceContract): number {
  return contract.stages.reduce((acc, stage) => acc + stage.valueCents, 0);
}

export function totalFinanced(contract: ServiceContract): number {
  const { count, valueCents } = contract.payment.installments;
  return count * valueCents;
}
