// This is a UI guard, never a substitute for server authorization.
const PUBLIC = new Set(["entrada", "biometria", "cadastro", "arbitragem", "ajuda", "p", "dividir"]);
export function guardedPath(path, session) {
  if (!session.loggedIn && !PUBLIC.has(path.split("/")[0])) return "entrada";
  if (session.loggedIn && session.person === "banco" && !path.startsWith("banco")) return "banco/visao";
  if (session.person !== "banco" && path.startsWith("banco")) return "inicio";
  return path;
}

export function signedOutUi(ui) {
  return { ...ui, sheet: null, toast: null, errors: {}, drafts: {}, busy: {}, payment: null,
    returnTo: undefined, resumeTo: undefined, hideValues: true, second: undefined, dual: false };
}
