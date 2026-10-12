import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
// @ts-expect-error Browser module intentionally uses plain JavaScript.
import { isValidCnpj, parseChargeRecipient, recipientChannels, recipientPerson } from '../../public/js/domain/charge-recipient.js';

describe('charge recipient identification', () => {
  it('normalizes Brazilian mobile and landline numbers, including country code', () => {
    assert.deepEqual(parseChargeRecipient('phone', '+55 (11) 98888-1001'), { kind: 'phone', contact: '(11) 98888-1001' });
    assert.deepEqual(parseChargeRecipient('phone', '1133334444'), { kind: 'phone', contact: '(11) 3333-4444' });
    for (const input of ['', '123', '00123456789', '1191234567', 'ligar11988881001', 'tel:11988881001']) assert.equal(parseChargeRecipient('phone', input), null);
  });
  it('uses the selected type to distinguish eleven-digit CPF and mobile numbers', () => {
    assert.deepEqual(parseChargeRecipient('document', '52998224725'), { kind: 'cpf', contact: '529.982.247-25' });
    assert.equal(parseChargeRecipient('document', '11988881001'), null);
    assert.equal(parseChargeRecipient('phone', '52998224725')?.kind, 'phone');
    for (const input of ['111.111.111-11', '52998224726', 'CPF 52998224725']) assert.equal(parseChargeRecipient('document', input), null);
  });
  it('checks numeric and alphanumeric CNPJs with the Receita Federal sample algorithm', () => {
    for (const input of ['12.345.678/0001-95', '12.ABC.345/01DE-35', '12abc34501de35']) assert.equal(isValidCnpj(input), true);
    assert.deepEqual(parseChargeRecipient('document', '12abc34501de35'), { kind: 'cnpj', contact: '12.ABC.345/01DE-35' });
    for (const input of ['12.345.678/0001-90', '12.ABC.345/01DE-36', '00000000000000', '12.ABC.345/01DE-AA']) assert.equal(isValidCnpj(input), false);
  });
  it('normalizes e-mail and rejects missing or malformed identification', () => {
    assert.deepEqual(parseChargeRecipient('email', ' Cliente+Teste@Exemplo.com '), { kind: 'email', contact: 'cliente+teste@exemplo.com' });
    for (const input of ['', 'cliente@', '@exemplo.com', 'cliente@exemplo', 'cliente exemplo@exemplo.com']) assert.equal(parseChargeRecipient('email', input), null);
    assert.equal(parseChargeRecipient('unknown', '11988881001'), null);
  });
  it('matches only local profiles with a full identifier; masked documents never match', () => {
    const people = [{ id: 'local', phone: '(11) 98888-1001', email: 'Cliente@Exemplo.com', clientDoc: 'CPF 529.982.247-25' }, { id: 'masked', clientDoc: 'CPF ***.982.247-**' }];
    for (const [kind, value] of [['phone', '11988881001'], ['email', 'cliente@exemplo.com'], ['document', '52998224725']]) assert.equal(recipientPerson(parseChargeRecipient(kind, value), people)?.id, 'local');
    assert.equal(recipientPerson(parseChargeRecipient('document', '52998224725'), people.slice(1)), null);
    assert.equal(recipientPerson(parseChargeRecipient('email', 'outro@exemplo.com'), people), null);
  });
  it('offers only compatible channels and keeps documents out of WhatsApp and e-mail', () => {
    assert.deepEqual(recipientChannels(parseChargeRecipient('phone', '11988881001')), ['whatsapp', 'link', 'qr']);
    assert.deepEqual(recipientChannels(parseChargeRecipient('phone', '1133334444')), ['link', 'qr']);
    assert.deepEqual(recipientChannels(parseChargeRecipient('email', 'cliente@exemplo.com')), ['email', 'link', 'qr']);
    assert.deepEqual(recipientChannels(parseChargeRecipient('document', '52998224725')), ['link', 'qr']);
    assert.deepEqual(recipientChannels(parseChargeRecipient('document', '52998224725'), true), ['app', 'link', 'qr']);
  });
});
