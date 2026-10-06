// Account snapshots from the public SDK, independent of session usage metrics.
const names = {
  premium_interactions: "Solicitações premium",
  chat: "Chat",
  completions: "Sugestões de código",
  ai_credits: "Créditos de IA",
  credits: "Créditos",
};
const num = (n) => typeof n === "number" && Number.isFinite(n) && n >= 0;
export function resetLabel(value, now = Date.now()) {
  if (!value) return "Reset não informado pelo Copilot";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-");
    return `Reset: ${d}/${m}/${y} (horário não informado)`;
  }
  // No inferred timezone/hour when the provider omitted its timezone.
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) return `Reset informado: ${value}`;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()))
    return "Reset não informado pelo Copilot";
  return `Reset informado: ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(date)} · ${Intl.DateTimeFormat().resolvedOptions().timeZone}${date.getTime() < now ? " · data já passou; próximo reset não confirmado" : ""}`;
}
export function quotaRows(data) {
  if (
    data?.available !== true ||
    !data.quotaSnapshots ||
    typeof data.quotaSnapshots !== "object"
  )
    return [];
  return Object.entries(data.quotaSnapshots)
    .slice(0, 20)
    .map(([key, q]) => {
      const unlimited =
        q.isUnlimitedEntitlement === true || q.entitlementRequests === -1;
      const noQuota = q.entitlementRequests === 0;
      const percent =
        !unlimited && !noQuota && num(q.remainingPercentage)
          ? Math.max(0, Math.min(100, 100 - q.remainingPercentage))
          : null;
      const fmt = (n) =>
        n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
      const count = num(q.usedRequests)
        ? `${fmt(q.usedRequests)} utilizados${num(q.entitlementRequests) ? ` de ${fmt(q.entitlementRequests)}` : ""}`
        : "Uso não informado";
      return {
        name: names[key] || key,
        percent,
        value: unlimited
          ? "Ilimitado"
          : noQuota
            ? "Sem cota"
            : percent === null
              ? "Indisponível"
              : `${fmt(percent)}%`,
        resetShort: !q.resetDate
          ? "Reset não informado"
          : /^\d{4}-\d{2}-\d{2}$/.test(q.resetDate)
            ? `Renova em ${q.resetDate.split("-").reverse().join("/")}`
            : /(Z|[+-]\d{2}:\d{2})$/.test(q.resetDate) &&
                Number.isFinite(new Date(q.resetDate).getTime())
              ? new Date(q.resetDate).getTime() < Date.now()
                ? "Próximo reset não informado"
                : `Renova em ${new Intl.DateTimeFormat("pt-BR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(q.resetDate))}`
              : "Ver reset nos detalhes",
        description: unlimited
          ? `Cota ilimitada · ${count}`
          : noQuota
            ? `Sem cota incluída nesta categoria · ${count}`
            : `${percent === null ? "Percentual não informado" : `${fmt(percent)}% utilizados`} · ${count}`,
        reset: resetLabel(q.resetDate),
        overage:
          num(q.overage) && q.overage > 0
            ? `Excedente informado: ${fmt(q.overage)}`
            : "",
      };
    });
}
