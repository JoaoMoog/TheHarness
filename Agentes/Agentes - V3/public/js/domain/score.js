// The credit note shown inside a payment (0 to 1000), from how the person pays: installments on time or late,
// finished protected payments, how much of the loan is in use, Pix Automático and Open Finance.
// Pure functions: fixed rules, never the AI. The full note and its history live in the BTG app.

export const NOTE_BANDS = Object.freeze([[800, "ótima"], [650, "boa"], [500, "regular"], [0, "baixa"]]);
const BASE = 600;
const PER_PAID = 10;
const PAID_CAP = 10;
const PER_LATE = 150;
const PER_COMPLETED = 20;
const COMPLETED_CAP = 5;
const SAFE_USE = 0.3;
const USE_PENALTY = 200;
const AUTO_PIX = 40;
const OPEN_FINANCE = 60;
const MAX_TIPS = 3;

/** The note, its band and up to three tips, each one with what to do. */
export function creditNote({ lateInstallments = 0, paidInstallments = 0, utilization = 0, openFinance = false, completedPayments = 0, autoPix = false }) {
  const raw = BASE
    + Math.min(paidInstallments, PAID_CAP) * PER_PAID
    - lateInstallments * PER_LATE
    - Math.round(Math.max(0, utilization - SAFE_USE) * USE_PENALTY)
    + Math.min(completedPayments, COMPLETED_CAP) * PER_COMPLETED
    + (autoPix ? AUTO_PIX : 0)
    + (openFinance ? OPEN_FINANCE : 0);
  const score = Math.max(0, Math.min(1000, raw));
  const band = NOTE_BANDS.find(([min]) => score >= min)[1];
  const tips = [
    lateInstallments > 0 && { key: "late", text: "Pague a parcela atrasada. É o que mais pesa na sua nota.", go: "#/financeiro" },
    utilization > SAFE_USE && { key: "use", text: "Use menos de 30% do empréstimo na hora que você tem." },
    !autoPix && { key: "autoPix", text: "Ative o Pix Automático nas parcelas e nunca pague atrasado.", action: "togglePixAuto" },
    !openFinance && { key: "openFinance", text: "Traga dados de outros bancos pelo Open Finance, no app do BTG.", go: "#/no-app-btg/open-finance" },
    completedPayments < COMPLETED_CAP && { key: "complete", text: "Conclua pagamentos com Aval. Cada um conta a seu favor." },
  ].filter(Boolean).slice(0, MAX_TIPS);
  return { score, band, tips };
}
