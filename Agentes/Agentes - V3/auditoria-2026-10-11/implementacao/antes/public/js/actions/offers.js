// Contextual bank offers: each one shown in the payment flow becomes an event, so the bank sees the funnel.
import { today } from "../store.js";

/** Records an offer shown to the current person (once per payment); accepted offers carry what the bank earns from them. */
export function recordOffer(s, { product, contractId, valueCents, accepted = false, revenueCents = 0 }) {
  const events = s.offerEvents ?? [];
  const person = s.session.person;
  const same = events.find((e) => e.product === product && e.contractId === contractId && e.person === person);
  const event = { id: same?.id ?? `OF-${events.length + 1}`, product, contractId, person, at: today(), accepted, valueCents, revenueCents };
  s.offerEvents = same ? events.map((e) => (e === same ? event : e)) : [event, ...events];
}

/** Marks the latest open offer of this product and payment as accepted. */
export function acceptOffer(s, product, contractId, { valueCents, revenueCents = 0 }) {
  const open = (s.offerEvents ?? []).find((e) => e.product === product && e.contractId === contractId && !e.accepted);
  if (!open) return recordOffer(s, { product, contractId, valueCents, accepted: true, revenueCents });
  s.offerEvents = s.offerEvents.map((e) => (e === open ? { ...e, accepted: true, valueCents, revenueCents } : e));
}
