// Credit pricing and decision. Pure functions: the bank's rules, never the AI.

export const CREDIT_RULES = Object.freeze({
  minCount: 3,
  maxCount: 24,
  maxGraceDays: 60,
  maxCommitment: 0.3,
  minApprovedCents: 100_000,
  openFinanceBoost: 0.5,
  reputationBoost: 0.1,
  reputationBoostFrom: 4.5,
  roundingCents: 10_000,
  iofFixed: 0.0038,
  iofDaily: 0.000082,
  iofDaysCap: 365,
});

const RATE_BY_REPUTATION = [
  [4.8, 0.0179],
  [4.5, 0.0199],
  [0, 0.0249],
];

export const rateFor = (reputation) => RATE_BY_REPUTATION.find(([min]) => reputation >= min)[1];

/** Price-table installment; interest keeps running during the grace period. */
export function priceInstallment(principalCents, monthlyRate, count, graceDays = 0) {
  const grown = principalCents * Math.pow(1 + monthlyRate, graceDays / 30);
  return Math.round((grown * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -count)));
}

export function iofCents(principalCents, count) {
  const days = Math.min(count * 30, CREDIT_RULES.iofDaysCap);
  return Math.round(principalCents * (CREDIT_RULES.iofFixed + CREDIT_RULES.iofDaily * days));
}

/** Monthly rate that makes the installments worth what the client actually received (amount minus IOF). */
function effectiveMonthlyRate(netCents, installment, count, graceDays) {
  const presentValue = (r) => {
    let pv = 0;
    for (let k = 1; k <= count; k += 1) pv += installment / Math.pow(1 + r, k + graceDays / 30);
    return pv;
  };
  let low = 0;
  let high = 1;
  for (let i = 0; i < 80; i += 1) {
    const mid = (low + high) / 2;
    if (presentValue(mid) > netCents) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

function assertTerms({ amountCents, count, graceDays }) {
  if (!Number.isFinite(amountCents) || amountCents <= 0) throw new RangeError("amountCents must be positive");
  if (!Number.isInteger(count) || count < CREDIT_RULES.minCount || count > CREDIT_RULES.maxCount) {
    throw new RangeError(`count must be between ${CREDIT_RULES.minCount} and ${CREDIT_RULES.maxCount}`);
  }
  if (!Number.isFinite(graceDays) || graceDays < 0 || graceDays > CREDIT_RULES.maxGraceDays) {
    throw new RangeError(`graceDays must be between 0 and ${CREDIT_RULES.maxGraceDays}`);
  }
}

export function simulateCredit({ amountCents, count, graceDays, monthlyRate }) {
  assertTerms({ amountCents, count, graceDays });
  const installmentCents = priceInstallment(amountCents, monthlyRate, count, graceDays);
  const iof = iofCents(amountCents, count);
  const monthlyCet = effectiveMonthlyRate(amountCents - iof, installmentCents, count, graceDays);
  return {
    installmentCents,
    iofCents: iof,
    totalCents: installmentCents * count,
    cetYear: Math.pow(1 + monthlyCet, 12) - 1,
    monthlyRate,
    firstDueDays: 30 + graceDays,
  };
}

/** Largest principal whose installment still fits in the income commitment cap. */
function principalForInstallment(maxInstallment, monthlyRate, count, graceDays) {
  if (maxInstallment <= 0) return 0;
  const perReal = priceInstallment(100_000, monthlyRate, count, graceDays) / 100_000;
  return Math.floor(maxInstallment / perReal);
}

const roundDown = (cents) => Math.floor(cents / CREDIT_RULES.roundingCents) * CREDIT_RULES.roundingCents;

export function creditDecision(request) {
  const { amountCents, count, graceDays, incomeCents, monthlyDebtCents, availableLimitCents, hasLate, reputation, openFinanceShared } = request;
  assertTerms({ amountCents, count, graceDays });
  const monthlyRate = rateFor(reputation);
  const result = (status, reason, approvedCents) => ({
    status,
    reason,
    approvedCents,
    monthlyRate,
    simulation: simulateCredit({ amountCents: approvedCents || amountCents, count, graceDays, monthlyRate }),
  });
  if (hasLate) return result("denied", "late", 0);

  const boost = (openFinanceShared ? CREDIT_RULES.openFinanceBoost : 0) + (reputation >= CREDIT_RULES.reputationBoostFrom ? CREDIT_RULES.reputationBoost : 0);
  const limitCap = Math.round(availableLimitCents * (1 + boost));
  const incomeRoom = incomeCents * CREDIT_RULES.maxCommitment - monthlyDebtCents;
  const incomeCap = principalForInstallment(incomeRoom, monthlyRate, count, graceDays);
  const approvable = Math.min(amountCents, limitCap, incomeCap);
  const reason = approvable === amountCents ? null : incomeCap < limitCap ? "income" : "limit";

  if (reason === null) return result("approved", null, amountCents);
  const approvedCents = roundDown(approvable);
  if (approvedCents < CREDIT_RULES.minApprovedCents) return result("denied", reason, 0);
  return result("approvedLower", reason, approvedCents);
}
