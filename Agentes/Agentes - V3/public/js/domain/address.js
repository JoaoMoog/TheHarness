// Pure functions: the service address typed by CEP. The demo CEPs answer offline, so the presentation never
// depends on the network; other CEPs are looked up on ViaCEP by the action that calls these.

const CEP_DIGITS = 8;

/** Demo CEPs (synthetic addresses of the demo people), by the eight digits. */
const DEMO_CEPS = {
  "05435000": { street: "Rua Harmonia", district: "Vila Madalena", city: "São Paulo", uf: "SP" },
  "05433000": { street: "Rua Aspicuelta", district: "Vila Madalena", city: "São Paulo", uf: "SP" },
  "04538133": { street: "Avenida Brigadeiro Faria Lima", district: "Itaim Bibi", city: "São Paulo", uf: "SP" },
  "22071100": { street: "Rua Bulhões de Carvalho", district: "Copacabana", city: "Rio de Janeiro", uf: "RJ" },
};

/** The eight digits of a CEP, or null when it is not one. */
export function normalizeCep(text) {
  const digits = String(text ?? "").replace(/\D/g, "");
  return digits.length === CEP_DIGITS ? digits : null;
}

/** 05435000 → 05435-000 */
export const formatCep = (digits) => `${digits.slice(0, 5)}-${digits.slice(5)}`;

/** The address of a demo CEP, or null. */
export function demoCep(text) {
  const digits = normalizeCep(text);
  return digits ? DEMO_CEPS[digits] ?? null : null;
}

/** The address in one line, the way the app shows it: "Rua, 410 - ap 32 · Bairro · Cidade/UF". */
export function composeAddress({ street = "", number = "", complement = "", district = "", city = "", uf = "" }) {
  if (!street.trim()) return "";
  const line = [street.trim(), number.trim()].filter(Boolean).join(", ") + (complement.trim() ? ` - ${complement.trim()}` : "");
  const place = [city.trim(), uf.trim()].filter(Boolean).join("/");
  return [line, district.trim(), place].filter(Boolean).join(" · ");
}
