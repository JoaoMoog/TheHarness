// Session, profiles, notifications and account opening.
import { isValidCpf, maskCpf } from "../domain/cpf.js";
import { CONSENT_SCOPES } from "./account.js";
import { SELF, draft, freshAccount, getState, isNexoConnected, notifyBank, peopleOf, reset, setDraft, today, update } from "../store.js";
import { actions as A, go, ok, warn } from "./core.js";

A.back = () => (history.length > 1 ? history.back() : go("#/inicio"));
A.closeSheet = () => update((s) => { s.ui.sheet = null; });

/** Presenter switch: Marina, Carlos or the bank. Each person keeps both modes. */
A.switchRole = ({ role }) => {
  const registered = role !== SELF || Boolean(getState().people?.[SELF]);
  update((s) => {
    s.session.person = role;
    s.session.mode = peopleOf(s)[role]?.defaultMode ?? s.session.mode;
    s.session.loggedIn = registered;
    s.ui.sheet = null;
  });
  go(role === "banco" ? "#/banco/visao" : registered ? "#/inicio" : "#/cadastro");
};
A.setMode = ({ mode }) => {
  if (getState().session.mode === mode) return;
  update((s) => { s.session.mode = mode; s.ui.sheet = null; });
};
/** Menu shortcut for the other side of the account: switch the mode, then open the screen. */
A.goAs = ({ mode, to }) => {
  if (getState().session.mode !== mode) update((s) => { s.session.mode = mode; s.ui.sheet = null; });
  go(to);
};
A.toggleValues = () => update((s) => { s.ui.hideValues = !s.ui.hideValues; });
A.resetDemo = () => { reset(); go("#/inicio"); ok("Demonstração reiniciada."); };
A.login = () => go("#/biometria");
A.biometricOk = () => {
  update((s) => { s.session.loggedIn = true; });
  go(isNexoConnected(getState()) ? "#/inicio" : "#/conectar");
};
A.logout = () => { update((s) => { s.session.loggedIn = false; }); go("#/entrada"); };
A.downloadData = () => ok("Pedido registrado. O arquivo chega em até 48 horas.");

/** Opening a notification switches to the side of the account it belongs to. */
A.readNotification = ({ id, target }) => {
  update((s) => {
    const n = s.notifications.find((x) => x.id === id);
    if (!n) return;
    n.read = true;
    if (n.mode && s.session.person !== "banco") s.session.mode = n.mode;
  });
  if (target) go(target);
};

// Opening the Aval with the Nexo account: redirect to the Nexo app, the person authorizes there with biometrics,
// and comes back with the bank's customer data. Nothing is typed in the Aval.
const DEMO_CUSTOMER = Object.freeze({
  name: "Ana Ribeiro", cpf: "529.982.247-25", phone: "(11) 97777-3003", email: "ana.ribeiro@exemplo.com",
  address: "Rua Harmonia, 410 · Vila Madalena · São Paulo", account: "Conta corrente PF · ag 0001 · cc 7.310.552-8",
});

/** What the bank shares with the Aval after the authorization. Synthetic in this presentation: one demo customer. */
export const importedCustomer = () => ({ ...DEMO_CUSTOMER, doc: maskCpf(DEMO_CUSTOMER.cpf) });

/** In the Nexo app: the person authorizes with biometrics and is sent back to the Aval. */
A.nexoAuthorize = () => {
  setDraft("login.authorized", { at: today(), shareLimit: draft("conectar.limit", true) }, true);
  go("#/cadastro/dados");
};
A.importNexoAccount = () => {
  const auth = draft("login.authorized");
  if (!auth) return go("#/cadastro");
  if (!draft("signup.arbitration")) return warn("Aceite os termos e a cláusula compromissória para continuar.");
  const customer = importedCustomer();
  if (!isValidCpf(customer.cpf)) return warn("O Nexo enviou um CPF inválido. Tente entrar de novo.");
  const words = customer.name.split(/\s+/);
  update((s) => {
    s.people[SELF] = {
      id: SELF, first: words[0], name: customer.name, initials: words.slice(0, 2).map((w) => w[0].toUpperCase()).join(""), defaultMode: "contratante",
      clientName: customer.name, providerName: customer.name, clientDoc: customer.doc, providerDoc: customer.doc, activity: "Cliente Nexo",
      phone: customer.phone, email: customer.email, address: customer.address,
    };
    const scopes = CONSENT_SCOPES.filter(([, , required]) => required || auth.shareLimit).map(([label]) => label);
    const base = freshAccount();
    s.accounts[SELF] = { ...base, nexo: { status: "connected", kind: "PF", label: customer.account, since: today(), scopes }, preApprovedCents: auth.shareLimit ? base.preApprovedCents : 0 };
    s.session = { person: SELF, mode: "contratante", loggedIn: true };
    s.ui.drafts.login = undefined;
    s.ui.drafts.signup = undefined;
  });
  ok(`Olá, ${words[0]}! Sua conta Nexo está conectada ao Aval.`);
  go("#/inicio");
};
A.copied = () => ok("Copiado para a área de transferência.");
