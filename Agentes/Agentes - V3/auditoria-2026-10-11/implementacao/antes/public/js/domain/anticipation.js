// Who may receive a milestone before it is approved: the eligibility rules of the scope (section 04). Pure function;
// the bank sets the thresholds, the provider sees each one with his own number.

export const MIN_COMPLETED = 5;
export const MIN_REPUTATION = 4.5;
export const MAX_DISPUTE_RATE = 0.1;

const decimal = (n) => n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** The scope's requirements as [label, ok, hint]: completed services, reputation, few disputes, nothing late. */
export function anticipationEligibility({ completedServices = 0, reputation = 0, disputeRate = 0, lateInstallments = 0 }) {
  return [
    [`${completedServices} serviços concluídos (mínimo ${MIN_COMPLETED})`, completedServices >= MIN_COMPLETED, `Conclua ${MIN_COMPLETED - completedServices} serviço(s) a mais para antecipar.`],
    [`Nota ${decimal(reputation)} (mínimo ${decimal(MIN_REPUTATION)})`, reputation >= MIN_REPUTATION, "A nota vem das avaliações de quem contratou."],
    [`${Math.round(disputeRate * 100)}% de serviços com disputa (máximo ${Math.round(MAX_DISPUTE_RATE * 100)}%)`, disputeRate <= MAX_DISPUTE_RATE, "Disputas perdidas pesam contra a antecipação."],
    ["Nenhuma parcela atrasada", lateInstallments === 0, "Pague a parcela atrasada para voltar a antecipar."],
  ];
}
