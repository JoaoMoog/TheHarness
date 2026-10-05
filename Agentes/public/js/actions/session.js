// Session, profiles, notifications and account opening.
import { judge } from "../api.js";
import { PEOPLE, draft, getState, isNexoConnected, notifyBank, reset, setDraft, today, update } from "../store.js";
import { actions as A, go, ok, warn } from "./core.js";

A.back = () => (history.length > 1 ? history.back() : go("#/inicio"));
A.closeSheet = () => update((s) => { s.ui.sheet = null; });

/** Presenter switch: Marina, Carlos or the bank. Each person keeps both modes. */
A.switchRole = ({ role }) => {
  update((s) => {
    s.session.person = role;
    s.session.mode = PEOPLE[role]?.defaultMode ?? s.session.mode;
    s.session.loggedIn = true;
    s.ui.sheet = null;
  });
  go(role === "banco" ? "#/banco/visao" : "#/inicio");
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
A.toggleAi = () => update((s) => { s.settings.aiEnabled = !s.settings.aiEnabled; });
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

// Account opening (fraud signals always reach a bank analyst)
A.markCapture = ({ field }) => setDraft(`signup.${field}`, true, false);
A.submitSignup = async () => {
  const name = draft("signup.name").trim();
  const documentName = draft("signup.documentName").trim();
  const services = draft("signup.services").trim();
  if (!name || !documentName || !services) return warn("Preencha nome, nome no documento e serviços.");
  if (!draft("signup.doc") || !draft("signup.selfie")) return warn("Envie a foto do documento e a selfie.");
  if (!draft("signup.arbitration")) return warn("Aceite os termos e a cláusula compromissória para continuar.");
  const fraud = await judge("fraudSignals", { accountName: name, documentName, serviceText: services }, "signup");
  update((s) => {
    s.newAccount = { name, documentName, services, status: "review", fraud, submittedAt: today(), arbitrationAcceptedAt: today(), by: s.session.person };
    notifyBank(s, "Conta nova em análise", name, "identification-card", "#/banco/fila/KYC-NEW");
  });
  go("#/conta-analise");
};
A.copied = () => ok("Copiado para a área de transferência.");
