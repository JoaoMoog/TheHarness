import { hasLocalAccount, registerLocalAccount, unlockLocalAccount, lockLocalAccount, locallyUnlocked } from "../local-auth.js";
import { VALIDATION } from "../runtime.js";
// Session, profiles, notifications and account opening.
import { isValidCpf, maskCpf } from "../domain/cpf.js";
import { CONSENT_SCOPES } from "./account.js";
import { SELF, canSee, contractById, personOfName, draft, freshAccount, getState, peopleOf, reset, setDraft, today, update } from "../store.js";
import { actions as A, go, ok, warn, fieldError } from "./core.js";
import { signedOutUi } from "../session-policy.js";

A.back = () => getState().ui.sheet ? A.closeSheet() : (history.length > 1 ? history.back() : go("#/inicio"));
A.closeSheet = () => update((s) => { s.ui.sheet = null; });

/** Presenter switch: Marina, Carlos or the bank. Each person keeps both modes. */
A.switchRole = ({ role }) => {
  if (!VALIDATION) return;
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
/** From the menu it says so; the presentation restarts quietly before a scenario. */
A.resetDemo = ({ quiet = false } = {}) => {
  reset();
  go("#/inicio");
  if (!quiet) ok("Demonstração reiniciada.");
};
A.login = () => go("#/biometria");
/** The BTG Banking login: Entrar opens the biometrics over the entry screen. */
A.openLoginBio = () => update((s) => { s.ui.sheet = { name: "loginBio", route: location.hash }; });
/** Biometrics confirmed: straight in when the Aval already knows her; the first time, to the BTG authorization. */
A.confirmLoginBio = () => {
  update((s) => { s.ui.sheet = null; });
  if (peopleOf()[SELF]) {
    update((s) => { s.session = { person: SELF, mode: "contratante", loggedIn: true }; });
    return A.biometricOk();
  }
  update((s) => { s.session = { ...s.session, person: SELF, loggedIn: false }; });
  go("#/cadastro");
};
A.biometricOk = () => {
  if (!VALIDATION) return go("#/biometria");
  if (!peopleOf()[getState().session.person]) return go("#/cadastro");
  const target = getState().ui.returnTo;
  update((s) => { s.session.loggedIn = true; });
  update((s) => { s.ui.returnTo = undefined; }, { silent: true });
  go(target ?? "#/inicio");
};
A.logout = () => {
  lockLocalAccount();
  update((s) => { s.session = { person: SELF, mode: "contratante", loggedIn: false }; s.ui = signedOutUi(s.ui); s.wa.on = false; });
  location.replace("#/entrada");
};
A.lockSession = () => {
  lockLocalAccount();
  update((s) => { s.session.loggedIn = false; s.ui.sheet = null; s.ui.toast = null; s.ui.hideValues = true; });
  location.replace("#/biometria");
};
A.dismissToast = () => update((s) => { s.ui.toast = null; });
A.downloadData = () => warn("Exportação ainda indisponível. Nenhuma solicitação foi registrada.");

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

// Opening the Aval with the BTG account: redirect to the BTG app, the person authorizes there with biometrics,
// and comes back with the bank's customer data. Nothing is typed in the Aval.
const DEMO_CUSTOMER = Object.freeze({
  name: "Ana Ribeiro", cpf: "529.982.247-25", phone: "(11) 97777-3003", email: "ana.ribeiro@exemplo.com",
  address: "Rua Harmonia, 410 · Vila Madalena · São Paulo", account: "Conta corrente PF · ag 0001 · cc 7.310.552-8",
});

/** What the bank shares with the Aval after the authorization. Synthetic in this presentation: one demo customer. */
export const importedCustomer = () => ({ ...DEMO_CUSTOMER, doc: maskCpf(DEMO_CUSTOMER.cpf) });

/** In the BTG app: the person authorizes with biometrics and is sent back to the Aval. */
A.btgAuthorize = () => {
  if (!VALIDATION) return go("#/cadastro");
  setDraft("login.authorized", { at: today() }, true);
  go("#/cadastro/dados");
};
A.importBtgAccount = () => {
  if (!VALIDATION) return go("#/cadastro");
  const auth = draft("login.authorized");
  if (!auth) return go("#/cadastro");
  if (!draft("signup.arbitration")) return fieldError("signup.arbitration", "Leia e aceite os termos para continuar o teste.");
  const customer = importedCustomer();
  if (!isValidCpf(customer.cpf)) return warn("O BTG enviou um CPF inválido. Tente entrar de novo.");
  const words = customer.name.split(/\s+/);
  update((s) => {
    s.people[SELF] = {
      id: SELF, first: words[0], name: customer.name, initials: words.slice(0, 2).map((w) => w[0].toUpperCase()).join(""), defaultMode: "contratante",
      clientName: customer.name, providerName: customer.name, clientDoc: customer.doc, providerDoc: customer.doc, activity: "Cliente BTG",
      phone: customer.phone, email: customer.email, address: customer.address,
    };
    const scopes = CONSENT_SCOPES.map(([label]) => label);
    const base = freshAccount();
    s.accounts[SELF] = { ...base, btg: { status: "connected", kind: "PF", label: customer.account, since: today(), scopes } };
    s.session = { person: SELF, mode: "contratante", loggedIn: true };
    s.ui.drafts.login = undefined;
    s.ui.drafts.signup = undefined;
  });
  const back = getState().ui.returnTo;
  if (back) update((s) => { s.ui.returnTo = undefined; });
  ok(`Olá, ${words[0]}! Sua conta BTG está conectada.`);
  go(back ?? "#/inicio");
};
A.copied = async ({ text } = {}) => {
  if (!text) return warn("Não há um código válido para copiar neste teste.");
  try {
    if (!navigator.clipboard?.writeText) return warn("A cópia não está disponível neste aparelho.");
    await navigator.clipboard.writeText(text);
    ok("Copiado para a área de transferência.");
  } catch { warn("Não foi possível copiar. Tente novamente."); }
};

let authBusy = false;
const localValue = (key) => document.querySelector(`[data-local="${key}"]`)?.value ?? '';
function completeLocalLogin() {
  const s0 = getState();
  const target = s0.ui.returnTo ?? s0.ui.resumeTo ?? '#/inicio';
  update((s) => { s.session = { person: SELF, mode: 'contratante', loggedIn: true }; s.ui.returnTo = undefined; s.ui.errors = {}; });
  go(target);
}
A.localSignup = async () => {
  if (authBusy) return;
  const name = String(draft('signup.name', '')).trim();
  const pin = localValue('signup.pin');
  if (name.length < 2 || name.length > 80) return fieldError('signup.name', 'Informe um nome de 2 a 80 caracteres.');
  if (!/^\d{6}$/.test(pin)) return fieldError('signup.pin', 'Crie um código com 6 números.');
  if (pin !== localValue('signup.confirm')) return fieldError('signup.confirm', 'Os códigos precisam ser iguais.');
  authBusy = true;
  try {
    await registerLocalAccount(pin);
    update((s) => {
      const words = name.split(/\s+/);
      s.people[SELF] = { id: SELF, name, first: words[0], initials: words.slice(0, 2).map(w => w[0]).join('').toUpperCase(),
        clientName: name, providerName: name, clientDoc: 'Conta local', providerDoc: 'Conta local', activity: 'Pagamentos simulados', defaultMode: 'contratante', phone: '', email: '' };
      s.accounts[SELF] = { ...freshAccount(), btg: { status: 'connected', kind: 'PF', label: 'Conta simulada · sem vínculo bancário', scopes: [], since: today() } };
      s.ui.drafts.signup = undefined;
    });
    completeLocalLogin();
  } catch (error) { fieldError('signup.pin', error.message ?? 'Não foi possível salvar a conta neste aparelho.'); }
  finally { authBusy = false; }
};
A.localLogin = async () => {
  if (authBusy) return;
  const pin = localValue('login.pin');
  if (!/^\d{6}$/.test(pin)) return fieldError('login.pin', 'Digite os 6 números do seu código.');
  authBusy = true;
  try { await unlockLocalAccount(pin); completeLocalLogin(); }
  catch (error) { fieldError('login.pin', error.message ?? 'Não foi possível entrar. Tente novamente.'); }
  finally { authBusy = false; }
};
A.returnToSelf = () => {
  if (!locallyUnlocked()) return go(hasLocalAccount() ? '#/biometria' : '#/cadastro');
  update((s) => { s.session = { person: SELF, mode: 'contratante', loggedIn: true }; s.ui.sheet = null; s.ui.errors = {}; });
  go('#/inicio');
};
A.simulateCounterparty = ({ id }) => {
  const s0 = getState();
  const c = contractById(s0, id);
  if (!canSee(c, s0)) return warn("Combinado não encontrado.");
  const current = peopleOf(s0)[s0.session.person];
  const provider = current.providerName !== c.provider;
  const other = personOfName(provider ? c.provider : c.client, s0);
  if (!other) return warn("A outra parte não tem perfil simulado neste aparelho.");
  update((s) => {
    s.session = { person: other.id, mode: provider ? "prestador" : "contratante", loggedIn: true };
    s.ui.sheet = null; s.ui.errors = {}; s.ui.toast = null;
  });
  go(`#/servico/${id}`);
};
