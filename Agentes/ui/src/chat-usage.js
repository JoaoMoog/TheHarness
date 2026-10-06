const count = (n) =>
  typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : null;
const difference = (end, start) => {
  end = count(end);
  start = count(start);
  return end !== null && start !== null && end >= start ? end - start : null;
};
export function usageDelta(start, end) {
  return Object.fromEntries(
    ["totalNanoAiu", "inputTokens", "outputTokens", "premiumRequests"].map(
      (key) => [key, difference(end?.[key], start?.[key])],
    ),
  );
}
export const emptyUsage = () => ({
  totalNanoAiu: 0,
  inputTokens: 0,
  outputTokens: 0,
  premiumRequests: 0,
});
export function usageLabel(usage) {
  const fmt = (value) =>
    value.toLocaleString("pt-BR", { maximumFractionDigits: 9 });
  const parts = [];
  if (count(usage?.totalNanoAiu) !== null) {
    // SDK reports nano-AIU, not a finalized invoice. Keep the actual unit explicit.
    parts.push(`Consumo: ${fmt(usage.totalNanoAiu / 1e9)} AIU (CLI)`);
  } else parts.push("Créditos não informados pelo Copilot");
  if (count(usage?.inputTokens) !== null && count(usage?.outputTokens) !== null)
    parts.push(
      `${fmt(usage.inputTokens)} tokens de entrada · ${fmt(usage.outputTokens)} de saída`,
    );
  if (count(usage?.premiumRequests) !== null && usage.premiumRequests > 0)
    parts.push(`${fmt(usage.premiumRequests)} solicitações premium ponderadas`);
  return parts.join(" · ");
}
