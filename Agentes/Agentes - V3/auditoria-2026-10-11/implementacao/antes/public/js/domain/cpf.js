// Brazilian CPF: check digits and masking for display. Pure functions.

const CPF_LENGTH = 11;

const digitsOf = (text) => String(text ?? "").replace(/\D/g, "");

/** Check digit for the first `size` digits (weights size+1 down to 2). */
function checkDigit(digits, size) {
  const sum = [...digits.slice(0, size)].reduce((acc, d, i) => acc + Number(d) * (size + 1 - i), 0);
  const rest = (sum * 10) % 11;
  return rest === 10 ? 0 : rest;
}

/** True when the text holds 11 digits, not all equal, with both check digits right. */
export function isValidCpf(text) {
  const raw = String(text ?? "");
  if (/[a-z]/i.test(raw)) return false;
  const d = digitsOf(raw);
  if (d.length !== CPF_LENGTH || /^(\d)\1+$/.test(d)) return false;
  return checkDigit(d, 9) === Number(d[9]) && checkDigit(d, 10) === Number(d[10]);
}

/** Only the middle digits are shown, as on bank statements. */
export function maskCpf(text) {
  const d = digitsOf(text);
  return `CPF ***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}
