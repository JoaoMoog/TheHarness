import { isValidCpf } from './cpf.js';

export const RECIPIENT_KINDS = { phone: 'Telefone', document: 'CPF/CNPJ', email: 'E-mail' };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Receita Federal: modulo 11, character value = ASCII - 48. Numeric and alphanumeric CNPJs coexist.
// https://www.gov.br/receitafederal/pt-br/centrais-de-conteudo/publicacoes/perguntas-e-respostas/cnpj/cnpj-alfanumerico.pdf
export function isValidCnpj(value) {
  const raw = String(value ?? '').trim().toUpperCase();
  if (!/^[A-Z\d./\-]+$/.test(raw)) return false;
  const text = raw.replace(/[./\-]/g, '');
  if (!/^[A-Z\d]{12}\d{2}$/.test(text) || /^(.)\1+$/.test(text)) return false;
  const digit = (base) => {
    const weights = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const rest = [...base].reduce((sum, char, i) => sum + (char.charCodeAt(0) - 48) * weights[i], 0) % 11;
    return rest < 2 ? '0' : String(11 - rest);
  };
  return digit(text.slice(0, 12)) === text[12] && digit(text.slice(0, 13)) === text[13];
}

/** Explicit input kind avoids treating an eleven-digit CPF as a mobile number. */
export function parseChargeRecipient(kind, value) {
  const raw = String(value ?? '').trim();
  if (kind === 'email') return EMAIL.test(raw) ? { kind, contact: raw.toLowerCase() } : null;
  if (kind === 'phone') {
    if (!/^[\d\s()+\-]+$/.test(raw)) return null;
    const digits = raw.replace(/\D/g, '');
    const local = digits.startsWith('55') && [12, 13].includes(digits.length) ? digits.slice(2) : digits;
    if (!/^[1-9]\d(?:[2-5]\d{7}|9\d{8})$/.test(local)) return null;
    return { kind, contact: `(${local.slice(0, 2)}) ${local.slice(2, -4)}-${local.slice(-4)}` };
  }
  if (kind !== 'document' || !/^[A-Za-z\d.\s/\-]+$/.test(raw)) return null;
  const compact = raw.replace(/[.\s/\-]/g, '').toUpperCase();
  if (isValidCpf(compact)) return { kind: 'cpf', contact: compact.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') };
  if (isValidCnpj(compact)) return { kind: 'cnpj', contact: compact.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5') };
  return null;
}

const documentValue = (value) => String(value ?? '').replace(/^(CPF|CNPJ|MEI)\s*/i, '');
export function recipientPerson(recipient, people) {
  if (!recipient) return null;
  return people.find(person => {
    const candidates = recipient.kind === 'phone' ? [person.phone] : recipient.kind === 'email' ? [person.email] : [person.cpf, person.cnpj, person.clientDoc, person.providerDoc];
    const kind = ['cpf', 'cnpj'].includes(recipient.kind) ? 'document' : recipient.kind;
    return candidates.some(value => parseChargeRecipient(kind, kind === 'document' ? documentValue(value) : value)?.contact === recipient.contact);
  }) ?? null;
}

export function recipientChannels(recipient, known = false) {
  if (!recipient) return [];
  const direct = recipient.kind === 'email' ? ['email'] : recipient.kind === 'phone' && /\) 9/.test(recipient.contact) ? ['whatsapp'] : [];
  return [...(known ? ['app'] : []), ...direct, 'link', 'qr'];
}
export const recipientLabel = (recipient) => recipient?.kind === 'cpf' ? 'CPF' : recipient?.kind === 'cnpj' ? 'CNPJ' : RECIPIENT_KINDS[recipient?.kind] ?? 'Identificação';
