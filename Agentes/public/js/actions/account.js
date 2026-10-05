// Nexo account connection (consent, token) and Open Finance sharing. Without a Nexo account the Aval works only in cash mode.
import { PEOPLE, draft, getState, notify, setDraft, today, update } from "../store.js";
import { actions as A, go, ok, warn } from "./core.js";

const ACCOUNT_LABEL = {
  PF: "Conta corrente PF · ag 0001 · cc 4.281.993-1",
  PJ: "Nexo Empresas · MEI 45.118.903/0001-12",
};
export const CONSENT_SCOPES = [
  ["Dados cadastrais", "Nome, CPF ou CNPJ e endereço", true],
  ["Saldo e extrato da conta", "Para pagar com saldo e conciliar", true],
  ["Débito para Pix", "Você confirma cada pagamento", true],
  ["Limite pré-aprovado", "Para financiar serviços no Aval", false],
];
export const OPEN_FINANCE_BANKS = ["Itaú", "Bradesco", "Nubank", "Caixa", "Santander"];
const OPEN_FINANCE_BOOST = 0.5;

A.chooseNexoAccount = ({ kind }) => setDraft("conectar.kind", kind, false);
A.reviewConsent = () => go("#/conectar/permissoes");
A.confirmConsent = () => go("#/conectar/token");
A.authorizeConnect = () => {
  const kind = draft("conectar.kind", "PF");
  const shareLimit = draft("conectar.limit", true);
  update((s) => {
    const acc = s.accounts[s.session.person];
    acc.nexo = {
      status: "connected", kind, label: ACCOUNT_LABEL[kind], since: today(),
      scopes: CONSENT_SCOPES.filter(([, , required]) => required || shareLimit).map(([label]) => label),
    };
    if (!shareLimit) acc.preApprovedCents = 0;
    notify(s, PEOPLE[s.session.person].clientName, "Conta Nexo conectada", ACCOUNT_LABEL[kind], "bank", "#/contas", "contratante");
  });
  go("#/conectar/ok");
};
A.disconnectNexo = () => {
  update((s) => {
    const acc = s.accounts[s.session.person];
    acc.nexo = { ...acc.nexo, status: "none" };
  });
  warn("Conta Nexo desconectada. O Aval segue só no modo à vista, sem crédito nem antecipação.");
  go("#/contas");
};
A.useCashOnly = () => {
  update((s) => { s.accounts[s.session.person].nexo.status = "none"; });
  go("#/inicio");
};

A.toggleBank = ({ bank }) => {
  const banks = draft("of.banks", ["Itaú"]);
  setDraft("of.banks", banks.includes(bank) ? banks.filter((b) => b !== bank) : [...banks, bank], false);
};
A.confirmOpenFinance = () => {
  const banks = draft("of.banks", ["Itaú"]);
  if (banks.length === 0) return warn("Escolha pelo menos uma instituição.");
  if (getState().accounts[getState().session.person].nexo.status !== "connected") return warn("Conecte a conta Nexo antes de trazer dados de outros bancos.");
  update((s) => {
    const acc = s.accounts[s.session.person];
    acc.openFinance = { status: "shared", banks, since: today(), expires: "12 meses" };
    acc.preApprovedCents = Math.round(acc.preApprovedCents * (1 + OPEN_FINANCE_BOOST));
  });
  go("#/open-finance/ok");
};
A.revokeOpenFinance = () => {
  update((s) => {
    const acc = s.accounts[s.session.person];
    acc.openFinance = { status: "none", banks: [] };
    acc.preApprovedCents = Math.round(acc.preApprovedCents / (1 + OPEN_FINANCE_BOOST));
  });
  ok("Compartilhamento encerrado. Os dados deixam de ser usados.");
};
