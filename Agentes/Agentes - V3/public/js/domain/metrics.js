// Numbers of the demonstration for the business summary: money kept and released, accounts opened, offers and the
// bank's revenue. Pure functions over the state; the presentation compares a snapshot before and after each scenario.
import { funnelOf, soldOffers } from "./offers.js";

const sum = (list, fn) => list.reduce((acc, item) => acc + fn(item), 0);

/** What already went to the provider: released stages, the provider part of a split and partial releases. */
export const releasedCents = (c) =>
  sum(c.stages, (st) => (st.partialReleasedCents ?? 0) + (st.status === "released" ? st.valueCents : st.status === "split" ? st.split.providerCents : 0));

/** What is still kept by the bank for this payment. */
export const custodyCents = (c) => Math.max(0, c.paidInCents - releasedCents(c) - c.refundedCents);

/** The totals of the demo state. */
export function demoMetrics(s) {
  const contracts = s.contracts ?? [];
  const events = s.offerEvents ?? [];
  const sold = soldOffers(events);
  const guests = sum(contracts, (c) => (c.participants ?? []).filter((p) => p.btg).length);
  return {
    payments: contracts.length,
    guardedCents: sum(contracts, (c) => c.paidInCents),
    releasedCents: sum(contracts, releasedCents),
    anticipatedCents: sum(contracts, (c) => sum(c.stages, (st) => st.anticipation?.netCents ?? 0)),
    accounts: Object.keys(s.people ?? {}).length + guests,
    offersShown: sold.length,
    offersAccepted: sold.filter((e) => e.accepted).length,
    revenueCents: sum(funnelOf(events), (f) => f.revenueCents),
    disputesClosed: (s.disputes ?? []).filter((d) => d.status === "closed").length,
  };
}

/** What changed between two snapshots (a missing one counts as zero). */
export const metricsDelta = (before, after) => Object.fromEntries(Object.entries(after).map(([k, v]) => [k, v - (before?.[k] ?? 0)]));

/** The sum of two snapshots or deltas (a missing one counts as zero): the numbers of the scenarios shown, together. */
export const addMetrics = (total, more) => Object.fromEntries(Object.entries(more).map(([k, v]) => [k, v + (total?.[k] ?? 0)]));
