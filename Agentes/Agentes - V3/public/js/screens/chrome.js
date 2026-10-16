// Shared bits of the app chrome: money behind the "hide values" eye.
import { money } from "../ui.js";

/** Money that respects the "hide values" eye on the home screen. */
export const shown = (s, cents) => (s.ui.hideValues ? "R$ ••••" : money(cents));
