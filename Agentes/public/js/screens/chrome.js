// Shared bits of the app chrome: money behind the "hide values" eye and the count of services on each side.
import { isClientOf, isProviderOf } from "../store.js";
import { money } from "../ui.js";

/** Money that respects the "hide values" eye on the home screen. */
export const shown = (s, cents) => (s.ui.hideValues ? "R$ ••••" : money(cents));

const active = (c) => c.status !== "completed";

/** Services in progress on each side of the account. */
export const modeCounts = (s) => ({
  hiring: s.contracts.filter((c) => active(c) && isClientOf(c, s)).length,
  providing: s.contracts.filter((c) => active(c) && isProviderOf(c, s)).length,
});
