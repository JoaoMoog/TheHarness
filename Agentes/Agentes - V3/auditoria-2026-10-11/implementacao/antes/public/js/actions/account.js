// What the Aval asks from the BTG account when someone enters by a payment link. Connecting accounts and Open Finance
// live in the BTG app; the Aval only shows a shortcut to them. Without an account the Aval works in cash mode.
import { update } from "../store.js";
import { actions as A, go } from "./core.js";

// What the Aval reads from the BTG account at sign-in. The loan limit is not asked here: it shows up as an offer at the moment of paying.
export const CONSENT_SCOPES = [
  ["Dados cadastrais", "Nome, CPF ou CNPJ e endereço"],
  ["Saldo e extrato da conta", "Para pagar com saldo e conciliar"],
  ["Débito para Pix", "Você confirma cada pagamento"],
];

A.useCashOnly = () => {
  update((s) => { s.accounts[s.session.person].btg.status = "none"; });
  go("#/inicio");
};
